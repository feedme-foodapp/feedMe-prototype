/* Express */
import { Request, Response, NextFunction, response } from "express";

/* dotenv */
import * as dotenv from "dotenv";

/* Microsoft Azure */
import {
  BlobDeleteResponse,
  BlobServiceClient,
  BlockBlobUploadResponse,
} from "@azure/storage-blob";

import { DefaultAzureCredential } from "@azure/identity";

import {
  DocumentAnalysisClient,
  AzureKeyCredential,
  PrebuiltModels,
} from "@azure/ai-form-recognizer";

/* Model(s) */
import { ReceiptModel } from "../models/receipt";

import { CustomErrorResponseModel } from "../../shared/models/customErrorResponse";

/* Util(s) */
import {
  getMimeTypeOfBase64,
  createImgBuffer,
} from "../../utils/helper/helper";

dotenv.config();

/***
 * Use DefaultAzureCredential() to connect to storage account
 *
 * Login to account with Azure-CLI:
 * https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows?tabs=azure-cli
 ***/

// blobServiceClient
const blobServiceClient = new BlobServiceClient(
  `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
  new DefaultAzureCredential()
);

// formRecognizerClient
const formRecognizerClient = new DocumentAnalysisClient(
  `${process.env.AZURE_ENDPOINT}`,
  new AzureKeyCredential(`${process.env.AZURE_KEY}`)
);

// containerClient
const containerClient = blobServiceClient.getContainerClient(
  `${process.env.AZURE_STORAGE_CONTAINER}`
);

/* Receipt 'example_receipt.jpg' is stored on device */

// const receiptPath: string = path.join(
//   __dirname,
//   "../../../public/assets/receipt",
//   "example_receipt.jpg"
// );

const uploadBlobImage = async (receipt: ReceiptModel) => {
  const imgType = getMimeTypeOfBase64(receipt.content);
  const imgBuffer = createImgBuffer(receipt.content);

  const blockBlobClient = containerClient.getBlockBlobClient(
    `${receipt.id}.${imgType.split("/")[1]}`
  );

  const uploadBlobResponse = await blockBlobClient.upload(
    imgBuffer,
    imgBuffer.length,
    { blobHTTPHeaders: { blobContentType: imgType } }
  );
  return uploadBlobResponse;
};

const analyzeBlobImage = async (receipt: ReceiptModel) => {
  /***
   * If receipt exists on device, a readable stream have to be created in order to recognize the values of the image.
   * Therefore, the method createReadStream() from package fs is used, which allows to work with the file system of a computer.
   * This was initially used to test the method beginAnalyzeDocument() from the service Form Recognizer and is not used any further.
   *
   * A receipt taken by the application, will be then uploaded to the Blob Storage to create a public accessable URL:
   * Example: 'https://feedmereceipts.blob.core.windows.net/receipts/example_receipt.jpg'
   ***/

  // const readStream = fs.createReadStream();

  const imgType = getMimeTypeOfBase64(receipt.content);
  const blobPath = `${process.env.AZURE_STORAGE_BLOB_PATH}/${receipt.id}.${
    imgType.split("/")[1]
  }`;

  const poller = await formRecognizerClient.beginAnalyzeDocument(
    /***
     * The prebuilt model 'Receipt' is used to recognize values from a receipt.
     * This is totally fine for the first usage of the prototype.
     * In the further development process, it is required to train a custom model for a specific usecase.
     ***/
    PrebuiltModels.Receipt,
    blobPath,
    {
      onProgress: (state) => {
        console.log(`status: ${state.status}`);
      },
    }
  );

  const {
    documents: [receiptDocument],
  } = await poller.pollUntilDone();
  const receiptItems =  receiptDocument.fields.items?.values;
  return receiptItems;
};

const deleteBlobImage = async (receipt: ReceiptModel) => {
  const imgType = getMimeTypeOfBase64(receipt.content);
  const blockBlobClient = containerClient.getBlockBlobClient(
    `${receipt.id}.${imgType.split("/")[1]}`
  );
  const deleteBlobResponse = await blockBlobClient.delete();
  return deleteBlobResponse;
};

const uploadReceipt = (req: Request, res: Response, next: NextFunction) => {
  uploadBlobImage(req.body)
    .then((response: BlockBlobUploadResponse) => {
      res.statusMessage = "Uploading receipt was successful";
      res.statusCode = response._response.status;
      next();
    })
    .catch((error: BlockBlobUploadResponse) => {
      const tmpError: CustomErrorResponseModel = new Error();
      tmpError.message = "Failed to upload receipt";
      tmpError.statusCode = error._response.status;
      next(error);
    });
};

const analyzeReceipt = (req: Request, res: Response, next: NextFunction) => {
  analyzeBlobImage(req.body)
    .then((response) => {
      // res.send(response.poller.getResult()?.documents[0].fields.items);
      res.send(response);
    })
    .catch(() => {
      const error: CustomErrorResponseModel = new Error();
      error.message = "Failed to analyze receipt";
      error.statusCode = 400;
      next(error);
    });
};

const deleteReceipt = (req: Request, res: Response, next: NextFunction) => {
  deleteBlobImage(req.body)
    .then(() => {
      (res.statusMessage = "Deleting receipt was successful"),
        (res.statusCode = 200);
      next();
    })
    .catch((error: BlobDeleteResponse) => {
      const tmpError: CustomErrorResponseModel = new Error();
      tmpError.message = "Receipt does not exist";
      tmpError.statusCode = error._response.status;
      next(error);
    });
};

export { uploadReceipt, analyzeReceipt, deleteReceipt };
/* React */
import React from 'react';

/* React-Redux */
import {
    useDispatch
} from 'react-redux';

// import {
//     setToast
// } from 'src/redux/features/toastSlice';

import {
    setTooltip
} from 'src/redux/features/tooltipSlice';

import {
    setLoading
} from 'src/redux/features/loadingSlice';

import {
    setOCRAzureResult
} from 'src/redux/features/ocrAzureResultSlice';

import { v4 as uuidv4 } from 'uuid'

/* Ionic */
import {
    analytics
} from 'ionicons/icons';

// import {
//     checkmarkCircle
// } from 'ionicons/icons';

/* Axios */
import {
    AxiosResponse
} from 'axios';

/* Service(s) */
import {
    ServiceLoader
} from 'src/utils/services/serviceLoader';

/* Model(s) */
import {
    ReceiptModel
} from 'src/shared/models/receipt';

import {
    Tooltip
} from 'src/shared/models/tooltip';

/* Component(s) */
import ProcessBtnContainer from 'src/components/shared/process-btn-container/ProcessBtnContainer';

/* Stylesheet */
import styles from './OCRProcessor.module.scss';
import { OCRAzureResultModel } from '../../../shared/models/ocrAzureResult';

/* Interface(s) */
interface OCRProcessorProps {
    receipt: ReceiptModel;
}

const OCRProcessor: React.FC<OCRProcessorProps> = ({ receipt }) => {
    const dispatch = useDispatch();

    return (
        <div className={`${styles.ocr_processor} ${styles.flex_container}`}>
            <ProcessBtnContainer
                label={'Press button below to start analyzing document'}
                icon={analytics}
                disabled={!receipt.uploadedToBlobStorage}
                click={
                    () => {
                        if (!receipt.uploadedToBlobStorage) {
                            dispatch(setTooltip({
                                id: Tooltip.OCR_PROCESSOR,
                                content: { message: 'Upload image to Blob Storage' }
                            }));
                        } else {
                            /* Receipt can be analyzed after it was uploaded to Blob Storage */
                            dispatch(setLoading(true));

                            ServiceLoader.azure().analyzeReceipt(receipt).then((response: AxiosResponse) => {
                                dispatch(setLoading(false));
                                // dispatch(setToast({
                                //     show: true,
                                //     content: {
                                //         icon: checkmarkCircle,
                                //         message: response.data.message,
                                //         color: 'var(--ion-color-successColor)'
                                //     }
                                // }));

                                /***
                                 * Default result of Form Recognizer does not contain any id
                                 * But id is required to perform basic operations on result
                                ***/
                                dispatch(setOCRAzureResult(response.data.map((result: OCRAzureResultModel) => ({id: uuidv4(), kind: result.kind, properties: result.properties}))));
                            });
                        }
                    }
                }
            />
        </div>
    );
};

export default OCRProcessor;
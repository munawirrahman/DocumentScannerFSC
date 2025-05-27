import { LightningElement, api } from 'lwc';
import { getDocumentScanner } from 'lightning/mobileCapabilities';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import {
    FlowAttributeChangeEvent,
    FlowNavigationNextEvent
} from 'lightning/flowSupport';
import uploadFileToContent from '@salesforce/apex/DocumentScannerFSCController.uploadFileToContent';
import { NavigationMixin } from 'lightning/navigation';

// === Constants ===
const DEFAULT_FILE_NAME_PREFIX = 'ScannedDoc';
const DEFAULT_FILE_EXTENSION = '.jpeg';

export default class DocumentScannerFSC extends NavigationMixin(LightningElement) {
    // === Input Only properties ===
    @api isDebug;
    @api buttonLabel;
    @api buttonVariant;
    @api buttonIconName;
    @api buttonIconPosition;
    @api buttonClass;

    @api isGoToNextScreenAfterScan;
    @api recordId;
    @api isRequired;

    @api optionImageSource;
    @api optionPermissionRationaleText;
    @api optionScriptHint;
    @api optionEntityExtractionLanguageCode;

    // === Output Only properties ===
    @api scannedDocumentText;
    @api scannedDocumentBlocks;
    @api scannedDocumentEntities;
    @api contentDocumentId;

    // === Internal State ===
    isLoading = false;

    // Validate
    @api
    validate() {
        if(this.isRequired && !this.contentDocumentId) {
            this.showError('Document Error', 'Document is Required');
            return {
                isValid: false,
                errorMessage: 'Document is Required'
            };
        }
        else {
            return {
                isValid: true
            };
        }
    }

    get formattedJsonInput() {
        const debugInput = {
            buttonLabel : this.buttonLabel,
            buttonVariant : this.buttonVariant,
            buttonIconName : this.buttonIconName,
            buttonIconPosition : this.buttonIconPosition,
            buttonClass : this.buttonClass,
            isGoToNextScreenAfterScan : this.isGoToNextScreenAfterScan,
            recordId : this.recordId,
            optionImageSource : this.optionImageSource,
            optionPermissionRationaleText : this.optionPermissionRationaleText,
            optionScriptHint : this.optionScriptHint,
            optionEntityExtractionLanguageCode : this.optionEntityExtractionLanguageCode
        }
        return JSON.stringify(debugInput, null, 2);
    }

    get formattedJsonOutput() {
        const debugOutput = {
            scannedDocumentText:this.scannedDocumentText,
            scannedDocumentBlocks:this.scannedDocumentBlocks,
            scannedDocumentEntities:this.scannedDocumentEntities,
            contentDocumentId:this.contentDocumentId
        }
        return JSON.stringify(debugOutput, null, 2);
    }

    scanDocument() {
        const scanner = getDocumentScanner();
        if (!scanner.isAvailable()) {
            this.showError('Document Scan Error', 'Problem initiating scan. Are you using a mobile device?');
            return;
        }

        const options = {
            imageSource: this.optionImageSource,
            permissionRationaleText: this.optionPermissionRationaleText,
            scriptHint: this.optionScriptHint,
            entityExtractionLanguageCode: this.optionEntityExtractionLanguageCode,
            returnImageBytes: true,
            extractEntities: true
        };
        this.test = JSON.stringify(options)

        scanner.scan(options)
            .then(results => this.handleScanSuccess(results))
            .catch(error => this.handleScanFailure(error));
    }

    async handleScanSuccess(documents) {
        this.isLoading = true;
        try {
            const doc = documents?.[0];
            if (!doc) {
                this.showError('Scan Error', 'No document returned from scanner.');
                return;
            }

            if (doc.imageBytes && this.recordId) {
                await this.uploadDocumentToContent(doc.imageBytes);
            }

            // Assign output properties
            this.scannedDocumentText = doc.blocks ? doc.text : '';
            this.scannedDocumentBlocks = doc.blocks?.map(block => JSON.stringify(block)) || [];
            this.scannedDocumentEntities = doc.entities?.map(entity => JSON.stringify(entity)) || [];

            this.updateFlowOutputs({
                scannedDocumentText: this.scannedDocumentText,
                scannedDocumentBlocks: this.scannedDocumentBlocks,
                scannedDocumentEntities: this.scannedDocumentEntities
            });

            if (this.isGoToNextScreenAfterScan) {
                this.dispatchEvent(new FlowNavigationNextEvent());
            }
        } catch (err) {
            this.showError('Scan Processing Error', err?.message || 'Unexpected error during scan processing.');
        }
    }

    handleScanFailure(error) {
        const msg = `Error code: ${error?.code || 'UNKNOWN'}\nError message: ${error?.message || 'Unknown error'}`;
        this.showError('Document Scan Error', msg);
    }

    async uploadDocumentToContent(imageBytes) {
        try {
            const base64Data = imageBytes?.includes(',')
                ? imageBytes.split(',')[1]?.trim()
                : imageBytes;

            const fileName = `${DEFAULT_FILE_NAME_PREFIX}_${Date.now()}${DEFAULT_FILE_EXTENSION}`;

            const contentDocumentId = await uploadFileToContent({
                base64Data,
                fileName,
                recordId: this.recordId
            });

            if (contentDocumentId) {
                this.contentDocumentId = contentDocumentId;
                this.dispatchFlowChange('contentDocumentId', contentDocumentId);
                this.showSuccess('Upload Complete', 'The scanned document was uploaded and linked successfully.');
            } else {
                this.showError('Upload Failed', 'File upload returned no ID.');
            }
        } catch (error) {
            this.showError('File Upload Error', error?.body?.message || error.message || 'Unknown error');
        }
    }

    updateFlowOutputs({ scannedDocumentText, scannedDocumentBlocks, scannedDocumentEntities }) {
        this.dispatchFlowChange('scannedDocumentText', scannedDocumentText);
        this.dispatchFlowChange('scannedDocumentBlocks', scannedDocumentBlocks);
        this.dispatchFlowChange('scannedDocumentEntities', scannedDocumentEntities);
    }

    dispatchFlowChange(attributeName, value) {
        this.dispatchEvent(new FlowAttributeChangeEvent(attributeName, value));
    }

    showToast({ title, message, variant = 'info', mode = 'dismissable' }) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant, mode }));
        this.isLoading = false;
    }

    showError(title, message) {
        this.showToast({ title, message, variant: 'error', mode: 'sticky' });
    }

    showSuccess(title, message) {
        this.showToast({ title, message, variant: 'success' });
    }

    handleViewFile() {
        this[NavigationMixin.Navigate]({
            type: "standard__namedPage",
            attributes: {
                pageName: "filePreview",
            },
            state: {
                recordIds: this.contentDocumentId,
                selectedRecordId: this.contentDocumentId,
            },
        });
    }

    copyClipboard(event) {
        if(event.target.name === 'copyInputJSON' ){
            navigator.clipboard.writeText(this.formattedJsonInput);
            this.showSuccess('Copied to Clipboard', 'The input JSON was copied to the clipboard.');
        }
        else if(event.target.name === 'copyOutputJSON' ){
            navigator.clipboard.writeText(this.formattedJsonOutput);
            this.showSuccess('Copied to Clipboard', 'The output JSON was copied to the clipboard.');
        }
    }
}

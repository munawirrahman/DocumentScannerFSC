public with sharing class DocumentScannerFSCController {
    @AuraEnabled
    public static String uploadFileToContent(String base64Data, String fileName, String recordId) {
        ContentVersion version = new ContentVersion();
        version.Title = fileName;
        version.PathOnClient = fileName;
        version.VersionData = EncodingUtil.base64Decode(base64Data);
        insert version;

        ContentDocumentLink link = new ContentDocumentLink();
        link.ContentDocumentId = [
            SELECT ContentDocumentId FROM ContentVersion WHERE Id = :version.Id
        ].ContentDocumentId;
        link.LinkedEntityId = recordId;
        link.ShareType = 'V';
        link.Visibility = 'AllUsers';
        insert link;

        return link.ContentDocumentId;
    }
}

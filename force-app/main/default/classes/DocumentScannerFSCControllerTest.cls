@isTest
private class DocumentScannerFSCControllerTest {
    @isTest
    static void testUploadFileToContent() {
        // Use a generic record (Task requires minimal fields)
        Task testRecord = new Task(Subject = 'Test Subject');
        insert testRecord;

        // Prepare test data
        String base64Data = EncodingUtil.base64Encode(Blob.valueOf('This is a test file.'));
        String fileName = 'TestFile.txt';
        String recordId = testRecord.Id;

        Test.startTest();
        String contentDocumentId = DocumentScannerFSCController.uploadFileToContent(base64Data, fileName, recordId);
        Test.stopTest();

        // Assert that the ContentVersion was created correctly
        ContentVersion insertedVersion = [
            SELECT Id, Title, PathOnClient
            FROM ContentVersion
            WHERE Title = :fileName
            LIMIT 1
        ];
        System.assertEquals(fileName, insertedVersion.Title, 'ContentVersion Title mismatch');
        System.assertEquals(fileName, insertedVersion.PathOnClient, 'ContentVersion PathOnClient mismatch');

        // Assert that the ContentDocumentLink was created correctly
        ContentDocumentLink insertedLink = [
            SELECT ContentDocumentId, LinkedEntityId, ShareType, Visibility
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :recordId
            LIMIT 1
        ];
        System.assertEquals(recordId, insertedLink.LinkedEntityId, 'LinkedEntityId mismatch');
        System.assertEquals('V', insertedLink.ShareType, 'ShareType should be "V"');
        System.assertEquals('AllUsers', insertedLink.Visibility, 'Visibility should be "AllUsers"');
        System.assertEquals(contentDocumentId, insertedLink.ContentDocumentId, 'Returned ContentDocumentId does not match the actual link');
    }
}

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  constructor(public context: SecurityRuleContext) {
    const operation = context.operation.toUpperCase();
    const path = context.path;
    let message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n`;
    
    const requestDetails: any = {
      method: operation,
      path: `/databases/(default)/documents/${path}`,
    };

    if (context.requestResourceData) {
      requestDetails.resource = {
        data: context.requestResourceData
      };
    }
    
    message += JSON.stringify(requestDetails, null, 2);

    super(message);
    this.name = 'FirestorePermissionError';
  }
}

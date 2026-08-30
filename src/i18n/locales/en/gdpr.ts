/**
 * ============================================================================
 * Toroloom — GDPR i18n Translations (English)
 * ============================================================================
 *
 * GDPR compliance related translations for data export and deletion.
 * Reference: GDPR Articles 15, 17, 20
 * ============================================================================
 */

const gdpr = {
  // ── Page Title ──
  title: 'GDPR & Privacy',
  subtitle: 'Manage your data rights',

  // ── Data Export ──
  dataExport: 'Data Export',
  exportDescription: 'Export all your personal data in JSON format. This includes your profile, portfolio, trade history, watchlists, and more.',
  exportMyData: 'Export My Data',
  exporting: 'Exporting...',
  exportComplete: 'Export Complete',
  exportSuccessMessage: 'Your data has been exported successfully. Check your downloads folder.',
  exportFailed: 'Export Failed',
  exportFailedMessage: 'Failed to export your data. Please try again later.',
  exportInfo: 'Your data will be exported in JSON format. You can use this data to transfer your information to another service.',

  // ── Data Retention ──
  dataRetention: 'Data Retention',
  retentionDescription: 'View what data would be retained if you delete your account.',
  checkRetentionPolicy: 'Check Retention Policy',
  retainedData: 'Retained Data:',
  retainedRecords: 'Approximately {{count}} records will be retained.',

  // ── Account Deletion ──
  accountDeletion: 'Account Deletion',
  deletionWarning: 'This action is irreversible. Your account and personal data will be permanently deleted.',
  deletionDescription: 'Delete your account and all associated personal data. Financial records will be retained for 7 years as required by SEBI regulations.',
  deleteMyAccount: 'Delete My Account',
  confirmDeletion: 'Confirm Account Deletion',
  confirmDeletionText: 'Enter your email address to confirm deletion:',
  emailPlaceholder: 'your@email.com',
  emailMismatch: 'Email Mismatch',
  emailMismatchMessage: 'The email you entered does not match your account email.',
  cancel: 'Cancel',
  confirmDeletionBtn: 'Confirm Deletion',
  deleting: 'Deleting...',
  accountDeleted: 'Account Deleted',
  accountDeletedMessage: 'Your account and personal data have been deleted. Financial records are retained as required by SEBI regulations (7 years).',
  deletionFailed: 'Deletion Failed',
  deletionFailedMessage: 'Failed to delete your account. Please try again later or contact support.',

  // ── Your Rights ──
  yourRights: 'Your Rights',
  rightToAccess: 'Right to Access (Art. 15) - Export your data',
  rightToRectification: 'Right to Rectification (Art. 16) - Update your profile',
  rightToErasure: 'Right to Erasure (Art. 17) - Delete your account',
  rightToPortability: 'Right to Data Portability (Art. 20) - Transfer your data',

  // ── Retention Categories ──
  tradeHistoryRetention: 'Trade history (SEBI requirement)',
  financialRecordsRetention: 'Financial records (SEBI requirement: 7 years)',
  auditLogsRetention: 'Audit logs (anonymized, for compliance)',
};

export default gdpr;

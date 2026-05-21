/**
 * Re-export barrel — all server actions are organised into domain service files.
 * All DDL is in DATABASE.md — run it once on the database before starting the app.
 *
 * lib/services/
 *   auth.service.ts           ← loginUser, getMe, logoutAction, changeMyPassword
 *   student.service.ts        ← addStudentToDb, updateStudentInDb, deleteStudentFromDb,
 *                                restoreStudentInDb, getStudents, getStudentsByCollege,
 *                                getDeletedStudents, getDeletedStudentsByCollege,
 *                                getCollegeDashboardData, migrateBase64PhotosToBlob
 *   user.service.ts           ← registerUser, getUsers, getUsersByCollege, getDeletedUsers,
 *                                getDeletedUsersByCollege, deleteUser, restoreUserInDb,
 *                                updateUser, getUsersPageData
 *   college.service.ts        ← getCollegesFromDb, addCollegeToDb, deleteCollegeFromDb,
 *                                getDeletedColleges, restoreCollegeFromDb
 *   draft.service.ts          ← saveDraftToDb, getDraftsByUser, deleteDraftFromDb
 *   audit.service.ts          ← addAuditLog, getAuditLogs, getAuditLogsByCollege,
 *                                getLoginHistory, getLoginHistoryByCollege,
 *                                getStudentAuditLogs, getUserAuditLogs, getCollegeAuditLogs,
 *                                getExportLogs, getLogsPageData
 *   college-assets.service.ts ← saveCollegeAssets, getCollegeAssets
 *   id-card-type.service.ts   ← getIdCardTypes, getIdCardTypesForFaculty, addIdCardType,
 *                                deleteIdCardType, getDeletedIdCardTypes, restoreIdCardType
 *   public.service.ts         ← submitInquiry, submitCallbackRequest, InquiryData, CallbackReason
 *   migrations.service.ts     ← initApp, getAppInitData
 *
 * lib/utils/
 *   server-helpers.ts         ← t, nowIST, getRequestMeta, rowToStudent, getCollegeId,
 *                                dataUrlToBlob, blobToDataUrl
 *   audit-helpers.ts          ← logStudentAudit, logUserAudit, logCollegeAudit
 */

export * from './services/auth.service';
export * from './services/student.service';
export * from './services/user.service';
export * from './services/college.service';
export * from './services/draft.service';
export * from './services/audit.service';
export * from './services/college-assets.service';
export * from './services/id-card-type.service';
export * from './services/public.service';
export * from './services/migrations.service';

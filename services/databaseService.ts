// services/databaseService.ts
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase.config';
import { EvaluationRecord, User } from '../types';

/**
 * Fetches evaluations from Firestore.
 * Filters evaluations based on the user's role.
 * @param user The current user. Admins get all evaluations, evaluators get their own.
 * @returns A promise that resolves to an array of EvaluationRecords.
 */
export const getEvaluations = async (user: User): Promise<EvaluationRecord[]> => {
  try {
    console.log('🔥 === STARTING EVALUATION FETCH ===');
    console.log('🔥 Firebase app config:', db?.app?.options);
    console.log('🔥 Current auth user:', auth?.currentUser?.email);
    console.log('🔥 Fetching evaluations for user:', user);
    
    const evaluationsRef = collection(db, 'evaluations');
    console.log('🔥 Collection reference created:', evaluationsRef);
    
    let q;
    
    if (user.role === 'admin') {
      console.log('🔥 Admin user - fetching all evaluations');
      q = query(evaluationsRef, orderBy('timestamp', 'desc'));
    } else {
      console.log('🔥 Regular user - fetching evaluations for email:', user.email);
      q = query(
        evaluationsRef, 
        where('userEmail', '==', user.email),
        orderBy('timestamp', 'desc')
      );
    }
    
    console.log('🔥 Executing query...');
    const querySnapshot = await getDocs(q);
    console.log('🔥 Query completed, documents found:', querySnapshot.size);
    
    const evaluations: EvaluationRecord[] = [];
    
    querySnapshot.forEach((doc) => {
      console.log('🔥 Processing document:', doc.id, doc.data());
      evaluations.push({ ...doc.data(), id: doc.id } as EvaluationRecord);
    });
    
    console.log('🔥 Final evaluations array:', evaluations);
    console.log('🔥 === EVALUATION FETCH COMPLETE ===');
    return evaluations;
  } catch (error) {
    console.error('❌ === EVALUATION FETCH FAILED ===');
    console.error('❌ Detailed error fetching evaluations:', error);
    console.error('❌ Error name:', (error as any).name);
    console.error('❌ Error code:', (error as any).code);
    console.error('❌ Error message:', (error as any).message);
    console.error('❌ Auth state:', auth?.currentUser ? 'Authenticated' : 'Not authenticated');
    throw new Error(`Failed to fetch evaluations: ${(error as any).message || error}`);
  }
};

/**
 * Saves a new evaluation to Firestore.
 * @param evaluation The new evaluation record to add.
 * @returns A promise that resolves to the saved evaluation record.
 */
// Helper function to remove undefined values from objects
const removeUndefinedValues = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues);
  }
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefinedValues(value);
    }
  }
  return cleaned;
};

export const addEvaluation = async (evaluation: EvaluationRecord): Promise<EvaluationRecord> => {
  try {
    console.log('🔥 === STARTING EVALUATION SAVE ===');
    console.log('🔥 Firebase app config:', db?.app?.options);
    console.log('🔥 Current auth user:', auth?.currentUser?.email);
    console.log('🔥 Original evaluation data:', evaluation);
    console.log('🔥 Current user email in data:', evaluation.userEmail);
    
    // Test Firebase connection first
    console.log('🔥 Testing Firebase connection...');
    const testRef = collection(db, 'evaluations');
    console.log('🔥 Collection reference created successfully:', testRef.path);
    
    const { id, ...evaluationData } = evaluation;
    
    // Remove undefined values to prevent Firestore errors
    const cleanedData = removeUndefinedValues(evaluationData);
    console.log('🔥 Cleaned data (no undefined values):', cleanedData);
    console.log('🔥 About to call addDoc...');
    
    const docRef = await addDoc(testRef, cleanedData);
    console.log('🔥 addDoc completed successfully, document ID:', docRef.id);
    
    const savedEvaluation = { ...evaluation, id: docRef.id };
    
    console.log(`✅ Evaluation ${docRef.id} added to Firestore successfully.`);
    console.log('🔥 === EVALUATION SAVE COMPLETE ===');
    return savedEvaluation;
  } catch (error) {
    console.error('❌ === EVALUATION SAVE FAILED ===');
    console.error('❌ Error adding evaluation:', error);
    console.error('❌ Error name:', (error as any).name);
    console.error('❌ Error code:', (error as any).code);
    console.error('❌ Error message:', (error as any).message);
    console.error('❌ Full error object:', error);
    console.error('❌ Auth state:', auth?.currentUser ? 'Authenticated' : 'Not authenticated');
    throw new Error(`Failed to save evaluation: ${(error as any).message || error}`);
  }
};


/**
 * Updates an existing evaluation in Firestore.
 * @param updatedEvaluation The evaluation record with updates.
 * @returns A promise that resolves to the updated evaluation record.
 */
export const updateEvaluation = async (updatedEvaluation: EvaluationRecord): Promise<EvaluationRecord> => {
  try {
    const { id, ...evaluationData } = updatedEvaluation;
    const docRef = doc(db, 'evaluations', id);
    
    // Remove undefined values to prevent Firestore errors
    const cleanedData = removeUndefinedValues(evaluationData);
    console.log('🔥 Updating evaluation with cleaned data:', cleanedData);
    
    await updateDoc(docRef, cleanedData);
    
    console.log(`Evaluation ${id} updated in Firestore.`);
    return updatedEvaluation;
  } catch (error) {
    console.error('Error updating evaluation:', error);
    throw new Error('Failed to update evaluation');
  }
};

/**
 * Deletes an evaluation from Firestore.
 * @param evaluationId The ID of the evaluation to delete.
 * @returns A promise that resolves when the operation is complete.
 */
export const deleteEvaluation = async (evaluationId: string): Promise<void> => {
  try {
    const docRef = doc(db, 'evaluations', evaluationId);
    await deleteDoc(docRef);

    console.log(`Evaluation ${evaluationId} deleted from Firestore.`);
  } catch (error) {
    console.error('Error deleting evaluation:', error);
    throw new Error('Failed to delete evaluation');
  }
};

/**
 * Result of a bulk rename: which document IDs succeeded, and which failed
 * along with the specific error for each (so a caller can report exactly
 * what went wrong instead of an all-or-nothing failure).
 */
export interface RenameEvaluationGroupResult {
  succeededIds: string[];
  failed: { id: string; error: string }[];
}

/**
 * Bulk-renames a group of evaluations by setting their `evaluationName` field.
 * This is a targeted, minimal write: only `evaluationName` is touched on each
 * document — responses, scores, notes, and everything else are left exactly
 * as they are. Used to relabel a named (or "Unnamed") evaluation session
 * without disturbing any of the underlying evaluation data.
 *
 * Deliberately NOT an atomic batch: on legacy/imported data it's common for
 * a handful of IDs to be missing or malformed, and a Firestore batch is
 * all-or-nothing — one bad ID would silently fail the entire group. Instead
 * each document is updated independently so one failure can't sink the rest;
 * the caller gets back exactly which IDs succeeded and which didn't (and why).
 * @param evaluationIds The Firestore document IDs of the records to rename.
 * @param newName The new evaluation name to apply to all of them.
 */
export const renameEvaluationGroup = async (evaluationIds: string[], newName: string): Promise<RenameEvaluationGroupResult> => {
  const trimmedName = newName.trim();
  if (!trimmedName) throw new Error('New evaluation name cannot be empty.');
  if (evaluationIds.length === 0) return { succeededIds: [], failed: [] };

  // Process in modest concurrent chunks rather than one giant Promise.all,
  // so a large group doesn't fire hundreds of simultaneous requests at once.
  const CONCURRENCY = 50;
  const succeededIds: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (let i = 0; i < evaluationIds.length; i += CONCURRENCY) {
    const chunk = evaluationIds.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(id => updateDoc(doc(db, 'evaluations', id), { evaluationName: trimmedName }))
    );
    results.forEach((result, idx) => {
      const id = chunk[idx];
      if (result.status === 'fulfilled') {
        succeededIds.push(id);
      } else {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failed.push({ id, error: message });
      }
    });
  }

  if (failed.length > 0) {
    console.error(`renameEvaluationGroup: ${failed.length} of ${evaluationIds.length} failed to rename to "${trimmedName}".`, failed);
  }
  console.log(`renameEvaluationGroup: ${succeededIds.length} of ${evaluationIds.length} renamed to "${trimmedName}".`);

  return { succeededIds, failed };
};

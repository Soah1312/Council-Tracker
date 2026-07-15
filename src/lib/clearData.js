import { db } from './firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

export async function clearAllEvents() {
  console.log('Starting deletion of all events...');
  const eventsRef = collection(db, 'events');
  const snapshot = await getDocs(eventsRef);
  
  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  snapshot.docs.forEach((document) => {
    batch.delete(doc(db, 'events', document.id));
  });

  await batch.commit();
  console.log(`Batched-deleted ${snapshot.docs.length} events in 1 operation.`);
  return snapshot.docs.length;
}

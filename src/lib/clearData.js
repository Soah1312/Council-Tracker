import { db } from './firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

export async function clearAllEvents() {
  console.log('Starting deletion of all events...');
  const eventsRef = collection(db, 'events');
  const snapshot = await getDocs(eventsRef);
  let count = 0;
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, 'events', document.id));
    count++;
  }
  console.log(`Deleted ${count} events.`);
  return count;
}

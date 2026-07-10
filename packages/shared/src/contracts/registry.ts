import { AnyRouteContract } from './types';
import { healthContracts } from './health.contracts';
import { authContracts } from './auth.contracts';
import { usersContracts } from './users.contracts';
import { adminContracts } from './admin.contracts';
import { schedulingContracts } from './scheduling.contracts';
import { learningContracts } from './learning.contracts';
import { mushafContracts } from './mushaf.contracts';
import { rosterContracts } from './roster.contracts';
import { parentLinksContracts } from './parent-links.contracts';
import { recurringSlotsContracts } from './recurring-slots.contracts';
import { weakAyahsContracts } from './weak-ayahs.contracts';
import { curriculumPlansContracts } from './curriculum-plans.contracts';
import { milestonesContracts } from './milestones.contracts';
import { ijazahsContracts } from './ijazahs.contracts';
import { certificatesContracts } from './certificates.contracts';
import { accountContracts } from './account.contracts';
import { mediaContracts } from './media.contracts';
import { communicationContracts } from './communication.contracts';
import { progressContracts } from './progress.contracts';
import { halaqaContracts } from './halaqa.contracts';

/** Every declared contract. Tests iterate this; an endpoint here but absent
 *  from the endpoint manifest (or vice versa, once its module is swapped) fails CI. */
export const contractRegistry: AnyRouteContract[] = [
  ...Object.values(healthContracts),
  ...Object.values(authContracts),
  ...Object.values(usersContracts),
  ...Object.values(adminContracts),
  ...Object.values(schedulingContracts),
  ...Object.values(learningContracts),
  ...Object.values(mushafContracts),
  ...Object.values(rosterContracts),
  ...Object.values(parentLinksContracts),
  ...Object.values(recurringSlotsContracts),
  ...Object.values(weakAyahsContracts),
  ...Object.values(curriculumPlansContracts),
  ...Object.values(milestonesContracts),
  ...Object.values(ijazahsContracts),
  ...Object.values(certificatesContracts),
  ...Object.values(accountContracts),
  ...Object.values(mediaContracts),
  ...Object.values(communicationContracts),
  ...Object.values(progressContracts),
  ...Object.values(halaqaContracts),
];

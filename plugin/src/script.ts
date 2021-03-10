import { createLatencyRecord } from './aws/route53/create-records';
import { deleteLatencyRecords } from './aws/route53/delete-records';

(async() => {
  const arn = 'arn:aws:acm:eu-west-1:624074376577:certificate/d0b538a3-0309-42e1-9940-082119e8723e';
  console.log(await deleteLatencyRecords('eu-west-1','access-requests.test.api-dataportal.pernod-ricard.io', console))
  console.log(await deleteLatencyRecords('eu-west-1','access-requests.test.api-dataportal.pernod-ricard.io', console))
  console.log(await createLatencyRecord('eu-west-1','access-requests.test.api-dataportal.pernod-ricard.io', undefined, console))
  console.log(await createLatencyRecord('eu-west-1','access-requests.test.api-dataportal.pernod-ricard.io', undefined, console))
})();

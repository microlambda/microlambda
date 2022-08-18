import { createCertificate } from "./create-certificate";
import { describeCertificate } from "./describe-certificate";
import { getClosestCertificate } from "./get-closest-certificate";
import { listCertificates } from "./list-certificates";
import { waitUntilCertificateIssued } from "./wait-until-certificate-issued";

export const certificateManager = {
  createCertificate,
  describeCertificate,
  getClosestCertificate,
  listCertificates,
  waitUntilCertificateIssued,
}

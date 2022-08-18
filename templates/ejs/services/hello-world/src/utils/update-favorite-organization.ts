import { UserModel } from '@dataportal/models';

export const updateFavoriteOrganization = async (relatedPortal: string, companyName: string): Promise<void> => {
  const userModel = new UserModel();
  const users = await userModel.listAd();
  const impactedUser = users.filter(
    (u) => u.ad_information && u.ad_information.companyName && u.ad_information.companyName === companyName,
  );
  impactedUser.forEach((u) => (u.favorite_organization = relatedPortal));
  await Promise.all(impactedUser.map((u) => userModel.save(u)));
};

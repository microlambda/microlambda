import { ICurrentUser, IGroupJoin, IDashboard, ISource } from '@dataportal/types';

export const filterDashboards = (
  source: ISource,
  groups: IGroupJoin[],
  currentUser: ICurrentUser,
  isSourceOwner: boolean,
): IDashboard[] => {
  if (currentUser.role === 'admin' || isSourceOwner) {
    return source.powerbi;
  }

  const userGroups: Set<string> = new Set(groups.map((g) => g.pk));
  return source.powerbi
    ? source.powerbi.filter((dashboard) => {
        if (dashboard.is_disable) {
          return false;
        }
        if (!dashboard.allowed_groups || !dashboard.allowed_groups?.length) {
          return true;
        }
        const allowedGroups: Set<string> = new Set(dashboard.allowed_groups.map((g) => g.group_id));
        return (
          allowedGroups.size === 0 || new Set([...userGroups].filter((group) => allowedGroups.has(group))).size > 0
        );
      })
    : source.powerbi;
};

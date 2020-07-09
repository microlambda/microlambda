import { connect } from 'react-redux';
import { IPackageListProps, PackagesList } from '../components/packages-list';
import { IState } from '../state/store';

const mapStateToProps = (state: IState): IPackageListProps => ({
  packages: state.packages,
  selected: state.nodeSelected,
});

export default connect(mapStateToProps)(PackagesList);

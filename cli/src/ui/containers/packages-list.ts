import { connect } from 'react-redux';
import { IPackage, IState } from '../state/store';
import { PackagesList } from '../components/packages-list';

const mapStateToProps = (state: { graphStatus: IState }): { packages: IPackage[] } => ({
  packages: state.graphStatus.packages,
});

export default connect(mapStateToProps)(PackagesList);

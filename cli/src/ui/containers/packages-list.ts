import { connect } from 'react-redux';
import { IPackageListProps, PackagesList } from '../components/packages-list';
import { IReducersOutput } from '../state/reducers';

const mapStateToProps = (state: IReducersOutput): IPackageListProps => ({
  packages: state.graphReducer.packages,
  selected: state.graphReducer.nodeSelected,
});

export default connect(mapStateToProps)(PackagesList);

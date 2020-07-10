import { connect } from 'react-redux';
import { IServiceListProps, ServicesList } from '../components/services-list';
import { IReducersOutput } from '../state/reducers';

const mapStateToProps = (state: IReducersOutput): IServiceListProps => ({
  services: state.graphReducer.services,
  selected: state.graphReducer.nodeSelected,
});

export default connect(mapStateToProps)(ServicesList);

import { connect } from 'react-redux';
import { IService, IState } from '../state/store';
import { ServicesList } from '../components/services-list';

const mapStateToProps = (state: { graphStatus: IState }): { services: IService[] } => ({
  services: state.graphStatus.services,
});

export default connect(mapStateToProps)(ServicesList);

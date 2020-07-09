import { connect } from 'react-redux';
import { IServiceListProps, ServicesList } from '../components/services-list';
import { IState } from '../state/store';

const mapStateToProps = (state: IState): IServiceListProps => ({
  services: state.services,
  selected: state.nodeSelected,
});

export default connect(mapStateToProps)(ServicesList);

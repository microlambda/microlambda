import { connect } from 'react-redux';
import { IReducersOutput } from '../state/reducers';
import { ILernaState } from '../state/store';
import { LernaStatus } from '../components/lerna-status';

const mapStateToProps = (state: IReducersOutput): ILernaState => ({
  lerna: state.lernaStatusReducer.lerna,
});

export default connect(mapStateToProps)(LernaStatus);

import { connect } from 'react-redux';
import { ActionPanel, IActionPanelProps } from '../components/action-panel';
import { IReducersOutput } from '../state/reducers';

const mapStateToProps = (state: IReducersOutput): IActionPanelProps => ({
  packages: state.graphReducer.packages,
  services: state.graphReducer.services,
  selected: state.graphReducer.nodeSelected,
});

export default connect(mapStateToProps)(ActionPanel);

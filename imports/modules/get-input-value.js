import ReactDOM from 'react-dom';

export const getInputValue = (component) => ReactDOM.findDOMNode(component).value;

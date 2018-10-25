import React from 'react';
import PropTypes from 'prop-types';
import { LinkContainer } from 'react-router-bootstrap';
import { browserHistory } from 'react-router';
import AppNavigation from '../containers/app-navigation';

export class AdminLayout extends React.Component {
  constructor() {
    super();
    this.state = {
      active: {
        products: true,
        envelopes: false,
        couponsAndDiscounts: false,
        paperTypes: false,
        designer: false,
        mockups: false,
        users: false,
        wires: false
      },
      buttonClicked: false
    };
  }

  componentWillMount() {
    const propLocation = this.props.location;
    const pathname = propLocation.pathname;
    this.setState({
      active: {
        products: pathname.includes('products') || pathname === '/admin',
        envelopes: pathname.includes('envelopes'),
        couponsAndDiscounts: pathname.includes('couponsanddiscounts'),
        paperTypes: pathname.includes('papertypes'),
        designer: pathname.includes('designer'),
        mockups: pathname.includes('mockups'),
        users: pathname.includes('users'),
        wires: pathname.includes('wires')
      }
    });
  }

  componentWillReceiveProps(nextProps) {
    const pathname = nextProps.location.pathname;
    this.setState({
      active: {
        products: pathname.includes('products') || pathname === '/admin',
        envelopes: pathname.includes('envelopes'),
        couponsAndDiscounts: pathname.includes('couponsanddiscounts'),
        paperTypes: pathname.includes('papertypes'),
        designer: pathname.includes('designer'),
        mockups: pathname.includes('mockups'),
        users: pathname.includes('users'),
        wires: pathname.includes('wires')
      }
    });
  }

  getActiveClass(item) {
    return this.state.active[item] ? 'active' : '';
  }

  getButtonState() {
    if (this.state.active.products || this.state.active.designer) {
      return 'Create Product';
    } else if (this.state.active.envelopes) {
      return 'Create Envelope';
    } else if (this.state.active.paperTypes) {
      return 'Create';
    } else if (this.state.active.mockups) {
      return 'Create Mockup';
    } else if (this.state.active.users) {
      return 'Create User';
    } else if (this.state.active.couponsAndDiscounts) {
      return 'Coupons and Discounts';
    }
    return '';
  }

  handleClick() {
    if (this.state.active.products || this.state.active.designer) {
      browserHistory.push('/admin/products/create');
    } else if (this.state.active.envelopes) {
      // browserHistory.push(`${this.props.location.pathname}/create`);
    } else if (this.state.active.paperTypes) {
      browserHistory.push('/admin/papertypes/create');
    } else if (this.state.active.users) {
      browserHistory.push('/admin/users/create');
    }
    // browserHistory.push(`${this.props.location.pathname}/create`);
    return false;
  }

  render() {
    return (
      <div className="container-fluid admin-ui">
        <div className="mail-box">
          <aside className="sm-side">
            <div className="inbox-body">
              <a
                href="#myModal"
                data-toggle="modal"
                title="Compose"
                className="btn btn-compose"
                onClick={this.handleClick.bind(this)}
              >
                {this.getButtonState()}
              </a>
            </div>
            <ul className="inbox-nav inbox-divider">
              <li className={this.getActiveClass('users')}>
                <LinkContainer to="/admin/users">
                  <a href="#">
                    <i className="fa fa-users" />
                    Users
                  </a>
                </LinkContainer>
              </li>
              <li className={this.getActiveClass('wires')}>
                <LinkContainer to="/admin/wires">
                  <a href="#">
                    <i className="fa fa-picture-o" />
                    Wires
                  </a>
                </LinkContainer>
              </li>
            </ul>
          </aside>
          <aside className="lg-side">
            <div className="inbox-body">{this.props.children}</div>
          </aside>
        </div>
      </div>
    );
  }
}

AdminLayout.propTypes = {
  children: PropTypes.element,
  location: PropTypes.object
};

import React from 'react';
import PropTypes from 'prop-types';

export class Controls extends React.Component {
  constructor() {
    super();
    this.state = {
      searchTimeout: null,
      all: true,
      inactive: false,
      active: false
    };
  }
  onSearchInputChange() {
    if (!this.state.searchTimeout) {
      this.triggerSearch();
    } else {
      clearTimeout(this.state.searchTimeout);
      this.triggerSearch();
    }
  }

  triggerSearch() {
    this.setState({
      searchTimeout: setTimeout(() => {
        this.props.onTriggerSearch(this.refs.searchInput.value);
      }, 1500)
    });
  }

  handeCheckBoxChange(event) {
    const status = !this.state[event.target.id];
    const key = event.target.id;

    this.setState(
      {
        all: key === 'all' || (!status && key !== 'all'),
        inactive: key === 'inactive' && status,
        active: key === 'active' && status
      },
      () => {
        let statusFilter = key === 'all' && key;
        statusFilter =
          !statusFilter && this.state.inactive ? 'inactive' : statusFilter;
        statusFilter =
          !statusFilter && this.state.active ? 'active' : statusFilter;
        this.props.onTriggerStatusSearch(
          this.refs.searchInput.value,
          statusFilter
        );
      }
    );
  }

  render() {
    return (
      <div>
        <div className="chk-all">
          <input
            type="checkbox"
            className="mail-checkbox mail-group-checkbox"
          />
          <div className="btn-group">
            <a
              data-toggle="dropdown"
              href="#"
              className="btn mini all"
              aria-expanded="false"
            >
              All
              <i className="fa fa-angle-down " />
            </a>
            <ul className="dropdown-menu">
              <li>
                <a href="#"> None</a>
              </li>
              <li>
                <a href="#"> Read</a>
              </li>
              <li>
                <a href="#"> Unread</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="btn-group hidden-phone">
          <input
            type="text"
            className="form-control"
            ref="searchInput"
            placeholder="Search..."
            onChange={this.onSearchInputChange.bind(this)}
          />
        </div>
        <div className="chk-all">
          <input
            type="checkbox"
            className="mail-checkbox mail-group-checkbox"
            ref="allCheckBox"
            onChange={this.handeCheckBoxChange.bind(this)}
            id="all"
            value={this.state.all ? 'on' : ''}
            checked={this.state.all ? 'checked' : false}
          />
          All
        </div>
        <div className="chk-all">
          <input
            type="checkbox"
            className="mail-checkbox mail-group-checkbox"
            ref="activeCheckBox"
            onChange={this.handeCheckBoxChange.bind(this)}
            value={this.state.active ? 'on' : ''}
            id="active"
            checked={this.state.active ? 'checked' : false}
          />
          Active
        </div>
        <div className="chk-all">
          <input
            type="checkbox"
            className="mail-checkbox mail-group-checkbox"
            ref="inactiveCheckBox"
            onChange={this.handeCheckBoxChange.bind(this)}
            value={this.state.inactive ? 'on' : ''}
            id="inactive"
            checked={this.state.inactive ? 'checked' : false}
          />
          Inactive
        </div>
        <button
          className="btn btn-sm btn-danger"
          onClick={this.props.onLoadMore}
        >
          Load More
        </button>
      </div>
    );
  }
}

Controls.propTypes = {
  onLoadMore: PropTypes.func,
  onTriggerSearch: PropTypes.func,
  onTriggerStatusSearch: PropTypes.func
};

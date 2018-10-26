import React from 'react';
import PropTypes from 'prop-types';
import { Bert } from 'meteor/themeteorchef:bert';
import { Slingshot } from 'meteor/edgee:slingshot';
import { updateAvatar } from '../../../api/users/methods.js';

const Style = {
  padding: '10px'
};

const DEFAULT_IMG =
  'https://placeholdit.imgix.net/~text?txtsize=33&txt=350%C3%97250&w=350&h=250';

export class UserAvatar extends React.Component {
  componentWillMount() {
    this.uploader = new Slingshot.Upload('uploadTemplate');
    this.state = {
      user: this.props.user,
      uploading: false,
      uploadProgress: Math.round(this.uploader.progress() * 100) || 0,
      uploadedImage: false,
      hasImageSelected: false
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      user: nextProps.user
    });
  }

  handleInputFileChange() {
    const imageFiles = this.refs.uploadInput.files;
    this.setState({
      hasImageSelected: imageFiles && imageFiles.length !== 0
    });
  }

  upload() {
    const imageFiles = this.refs.uploadInput.files;

    if (!imageFiles || imageFiles.length === 0) {
      Bert.alert('Please select a file', 'danger');
      return;
    }

    this.setState({
      uploading: true
    });

    const uploadStatusInterval = setInterval(() => {
      this.setState({
        uploadProgress: Math.round(this.uploader.progress() * 100) || 0
      });
    }, 500);

    this.uploader.send(imageFiles[0], (error, url) => {
      if (error) {
        Bert.alert(error.reason, 'danger');
        return;
      }

      this.setState({
        uploading: false,
        hasImageSelected: false
      });

      updateAvatar.call({ _id: this.state.user._id, url }, err => {
        if (err) {
          Bert.alert(error.reason, 'danger');
        }
      });

      clearInterval(uploadStatusInterval);
    });
  }

  renderUploading() {
    return <p>Uploading: {this.state.uploadProgress}%</p>;
  }

  renderUploadButton() {
    if (this.state.hasImageSelected) {
      return (
        <button className="btn btn-primary" onClick={this.upload.bind(this)}>
          Upload Avatar
        </button>
      );
    }
    return '';
  }

  renderUploadInputControls() {
    return (
      <div>
        <input
          className="form-control"
          ref="uploadInput"
          type="file"
          id="template-file"
          accept="image/*"
          onChange={this.handleInputFileChange.bind(this)}
        />
        {this.renderUploadButton()}
      </div>
    );
  }

  render() {
    const user = this.state.user;
    const src = user && user.profile.avatar ? user.profile.avatar : DEFAULT_IMG;
    return (
      <div className="text-center">
        <div style={Style}>
          <img src={src} className="img-responsive" />
        </div>
        {this.state.uploading
          ? this.renderUploading()
          : this.renderUploadInputControls()}
      </div>
    );
  }
}

UserAvatar.propTypes = {
  user: PropTypes.object
};

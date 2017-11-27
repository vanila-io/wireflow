
# Wireflow - flow chart collaboration app

[![dependencies Status](https://david-dm.org/vanila-io/wireflow/status.svg)](https://david-dm.org/vanila-io/wireflow)
[![devDependencies Status](https://david-dm.org/vanila-io/wireflow/dev-status.svg)](https://david-dm.org/vanila-io/wireflow?type=dev)

Alpha version of Wireflow app made by [The Vanila Team](https://vanila.io).

### Official Website: [Wireflow.co](https://wireflow.co)

![Wireflow](https://i.imgur.com/ceXMd28.png)

## Around the web:

- Join our internal chat: https://chat.vanila.io/channel/wireflow
- [Youtube Video with a short story](https://youtu.be/zm0XbLmXtXY)
- [Post regarding Contribution](https://forums.meteor.com/t/anyone-interested-in-collaboration-on-wireflow-co-open-source-project/40716)
-
[Check a blog post for whole story](https://blog.vanila.io/we-were-hunted-on-producthunt-unexpectedly-e92e7179bdec)
- [ProductHunt page](https://www.producthunt.com/posts/wireflow)
- [Open Hub analysis of Wireflow code](https://www.openhub.net/p/wireflow)

# Install Locally

1) Install [Meteor.js](https://www.meteor.com)

2) In terminal:

Clone the repo:
```
git clone https://github.com/vanila-io/wireflow.git
cd wireflow
```

Install dependencies:

Install yarn and node-gyp globally (on your meteor)
```
meteor npm install -g yarn node-gyp
```

### For Unix/Linux:

Run the following command:
```
sudo apt-get install libcairo2-dev libjpeg-dev libgif-dev libjpeg8-dev libpango1.0-dev build-essential g++
```

### For Windows:
1. Install [Chocolatay](https://chocolatey.org/)
2. Open a command prompt with **Administrator** access, and run the following command,
```
choco install -y python2 gtk-runtime microsoft-build-tools libjpeg-turbo
```
3. You will need the cairo library which is bundled in GTK. Download the GTK 2 bundle for [Win32](http://ftp.gnome.org/pub/GNOME/binaries/win32/gtk+/2.24/gtk+-bundle_2.24.10-20120208_win32.zip) or [Win64](http://ftp.gnome.org/pub/GNOME/binaries/win64/gtk+/2.22/gtk+-bundle_2.22.1-20101229_win64.zip). Unzip the contents in `C:\GTK`.


Install node dependencies
```
meteor yarn
```

Start wireflow

```
meteor yarn start
```

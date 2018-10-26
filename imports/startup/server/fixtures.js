import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/alanning:roles';
import { Accounts } from 'meteor/accounts-base';
import { insertCategory } from '../../api/categories/methods.js';

import { insertGraphic } from '../../api/graphics/methods.js';

const users = [
  {
    email: process.env.ADMIN_USER || 'admin@example.com',
    password: process.env.ADMIN_PASS || 'password',
    profile: {
      name: { first: 'Wireflow', last: 'Admin' }
    },
    roles: ['admin']
  }
];

if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
  /**
   * Add Custom Admin to roles
   */
  const admin = Meteor.users.findOne({
    'emails.address': process.env.ADMIN_USER
  });
  Roles.addUsersToRoles([admin._id], ['admin']);
  const hasRole = Roles.userIsInRole(admin._id, ['admin']);
  console.log({ hasRole });
}

users.forEach(({ email, password, profile, roles }) => {
  const userExists = Meteor.users.findOne({ 'emails.address': email });
  if (!userExists) {
    const userId = Accounts.createUser({ email, password, profile });
    Roles.addUsersToRoles(userId, roles);
  }
});

/*categories*/

let Article = insertCategory.call({
  name: 'Article'
});
let Blog = insertCategory.call({
  name: 'Blog'
});
let ECommerce = insertCategory.call({
  name: 'ECommerce'
});
let Features = insertCategory.call({
  name: 'Features'
});
let Gallery = insertCategory.call({
  name: 'Gallery'
});
let Header = insertCategory.call({
  name: 'Header'
});
let Misc = insertCategory.call({
  name: 'Misc'
});
let Multimedia = insertCategory.call({
  name: 'Multimedia'
});
let SignIn = insertCategory.call({
  name: 'SignIn'
});
let Socials = insertCategory.call({
  name: 'Socials'
});

/*graphics*/

insertGraphic.call({
  name: 'Chat',
  cat: Socials,
  link: '/images/graphics/Socials/Chat.svg'
});
insertGraphic.call({
  name: 'Comments',
  cat: Socials,
  link: '/images/graphics/Socials/Comments.svg'
});
insertGraphic.call({
  name: 'Connection',
  cat: Socials,
  link: '/images/graphics/Socials/Connection.svg'
});
insertGraphic.call({
  name: 'Feeds',
  cat: Socials,
  link: '/images/graphics/Socials/Feeds.svg'
});
insertGraphic.call({
  name: 'Profile',
  cat: Socials,
  link: '/images/graphics/Socials/Profile.svg'
});
insertGraphic.call({
  name: 'Profile2',
  cat: Socials,
  link: '/images/graphics/Socials/Profile2.svg'
});
insertGraphic.call({
  name: 'Profile3',
  cat: Socials,
  link: '/images/graphics/Socials/Profile3.svg'
});
insertGraphic.call({
  name: 'Profile4',
  cat: Socials,
  link: '/images/graphics/Socials/Profile4.svg'
});
insertGraphic.call({
  name: 'Users1',
  cat: Socials,
  link: '/images/graphics/Socials/Users1.svg'
});
insertGraphic.call({
  name: 'Users2',
  cat: Socials,
  link: '/images/graphics/Socials/Users2.svg'
});
insertGraphic.call({
  name: 'UserSettings',
  cat: Socials,
  link: '/images/graphics/Socials/UserSettings.svg'
});
insertGraphic.call({
  name: 'UserSettings2',
  cat: Socials,
  link: '/images/graphics/Socials/UserSettings2.svg'
});

insertGraphic.call({
  name: 'ForgotPassword',
  cat: SignIn,
  link: '/images/graphics/SignIn/ForgotPassword.svg'
});
insertGraphic.call({
  name: 'ForgotPassword2',
  cat: SignIn,
  link: '/images/graphics/SignIn/ForgotPassword2.svg'
});
insertGraphic.call({
  name: 'SignIn',
  cat: SignIn,
  link: '/images/graphics/SignIn/SignIn.svg'
});
insertGraphic.call({
  name: 'SignIn2',
  cat: SignIn,
  link: '/images/graphics/SignIn/SignIn2.svg'
});
insertGraphic.call({
  name: 'SignUp',
  cat: SignIn,
  link: '/images/graphics/SignIn/SignUp.svg'
});
insertGraphic.call({
  name: 'SignUp2',
  cat: SignIn,
  link: '/images/graphics/SignIn/SignUp2.svg'
});

insertGraphic.call({
  name: 'Files',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/Files.svg'
});
insertGraphic.call({
  name: 'Songs1',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/Songs1.svg'
});
insertGraphic.call({
  name: 'Songs2',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/Songs2.svg'
});
insertGraphic.call({
  name: 'Songs3',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/Songs3.svg'
});
insertGraphic.call({
  name: 'UploadFiles',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/UploadFiles.svg'
});
insertGraphic.call({
  name: 'UploadImage',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/UploadImage.svg'
});
insertGraphic.call({
  name: 'Videos1',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/Videos1.svg'
});
insertGraphic.call({
  name: 'Videos2',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/Videos2.svg'
});
insertGraphic.call({
  name: 'Videos3',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/Videos3.svg'
});
insertGraphic.call({
  name: 'Videos4',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/Videos4.svg'
});
insertGraphic.call({
  name: 'VideosPlayer',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/VideosPlayer.svg'
});
insertGraphic.call({
  name: 'VideosPlayer2',
  cat: Multimedia,
  link: '/images/graphics/Multimedia/VideosPlayer2.svg'
});

insertGraphic.call({
  name: '404',
  cat: Misc,
  link: '/images/graphics/Misc/404.svg'
});
insertGraphic.call({
  name: 'About',
  cat: Misc,
  link: '/images/graphics/Misc/About.svg'
});
insertGraphic.call({
  name: 'Analitycs',
  cat: Misc,
  link: '/images/graphics/Misc/Analitycs.svg'
});
insertGraphic.call({
  name: 'Calender',
  cat: Misc,
  link: '/images/graphics/Misc/Calender.svg'
});
insertGraphic.call({
  name: 'Cards',
  cat: Misc,
  link: '/images/graphics/Misc/Cards.svg'
});
insertGraphic.call({
  name: 'Contact',
  cat: Misc,
  link: '/images/graphics/Misc/Contact.svg'
});
insertGraphic.call({
  name: 'Counter',
  cat: Misc,
  link: '/images/graphics/Misc/Counter.svg'
});
insertGraphic.call({
  name: 'Error',
  cat: Misc,
  link: '/images/graphics/Misc/Error.svg'
});
insertGraphic.call({
  name: 'Faqs',
  cat: Misc,
  link: '/images/graphics/Misc/Faqs.svg'
});
insertGraphic.call({
  name: 'Forum',
  cat: Misc,
  link: '/images/graphics/Misc/Forum.svg'
});
insertGraphic.call({
  name: 'Loading',
  cat: Misc,
  link: '/images/graphics/Misc/Loading.svg'
});
insertGraphic.call({
  name: 'Price',
  cat: Misc,
  link: '/images/graphics/Misc/Price.svg'
});
insertGraphic.call({
  name: 'Price2',
  cat: Misc,
  link: '/images/graphics/Misc/Price2.svg'
});
insertGraphic.call({
  name: 'Progress',
  cat: Misc,
  link: '/images/graphics/Misc/Progress.svg'
});
insertGraphic.call({
  name: 'Search',
  cat: Misc,
  link: '/images/graphics/Misc/Search.svg'
});
insertGraphic.call({
  name: 'SearchResults',
  cat: Misc,
  link: '/images/graphics/Misc/SearchResults.svg'
});
insertGraphic.call({
  name: 'Settings',
  cat: Misc,
  link: '/images/graphics/Misc/Settings.svg'
});
insertGraphic.call({
  name: 'Sitemap',
  cat: Misc,
  link: '/images/graphics/Misc/Sitemap.svg'
});
insertGraphic.call({
  name: 'Socials',
  cat: Misc,
  link: '/images/graphics/Misc/Socials.svg'
});
insertGraphic.call({
  name: 'Steps',
  cat: Misc,
  link: '/images/graphics/Misc/Steps.svg'
});
insertGraphic.call({
  name: 'Subscribde',
  cat: Misc,
  link: '/images/graphics/Misc/Subscribde.svg'
});
insertGraphic.call({
  name: 'Tags',
  cat: Misc,
  link: '/images/graphics/Misc/Tags.svg'
});
insertGraphic.call({
  name: 'team',
  cat: Misc,
  link: '/images/graphics/Misc/team.svg'
});
insertGraphic.call({
  name: 'UnderContruction',
  cat: Misc,
  link: '/images/graphics/Misc/UnderContruction.svg'
});

insertGraphic.call({
  name: 'Header1',
  cat: Header,
  link: '/images/graphics/Header/Header1.svg'
});
insertGraphic.call({
  name: 'Header2',
  cat: Header,
  link: '/images/graphics/Header/Header2.svg'
});
insertGraphic.call({
  name: 'Header3',
  cat: Header,
  link: '/images/graphics/Header/Header3.svg'
});
insertGraphic.call({
  name: 'Header4',
  cat: Header,
  link: '/images/graphics/Header/Header4.svg'
});
insertGraphic.call({
  name: 'Header5',
  cat: Header,
  link: '/images/graphics/Header/Header5.svg'
});
insertGraphic.call({
  name: 'Header6',
  cat: Header,
  link: '/images/graphics/Header/Header6.svg'
});

insertGraphic.call({
  name: 'Gallery1',
  cat: Gallery,
  link: '/images/graphics/Gallery/Gallery1.svg'
});
insertGraphic.call({
  name: 'Gallery2',
  cat: Gallery,
  link: '/images/graphics/Gallery/Gallery2.svg'
});
insertGraphic.call({
  name: 'Gallery3',
  cat: Gallery,
  link: '/images/graphics/Gallery/Gallery3.svg'
});
insertGraphic.call({
  name: 'Gallery4',
  cat: Gallery,
  link: '/images/graphics/Gallery/Gallery4.svg'
});
insertGraphic.call({
  name: 'Gallery5',
  cat: Gallery,
  link: '/images/graphics/Gallery/Gallery5.svg'
});
insertGraphic.call({
  name: 'Gallery6',
  cat: Gallery,
  link: '/images/graphics/Gallery/Gallery6.svg'
});

insertGraphic.call({
  name: 'Features1',
  cat: Features,
  link: '/images/graphics/Features/Features1.svg'
});
insertGraphic.call({
  name: 'Features2',
  cat: Features,
  link: '/images/graphics/Features/Features2.svg'
});
insertGraphic.call({
  name: 'Features3',
  cat: Features,
  link: '/images/graphics/Features/Features3.svg'
});
insertGraphic.call({
  name: 'Features4',
  cat: Features,
  link: '/images/graphics/Features/Features4.svg'
});
insertGraphic.call({
  name: 'Features5',
  cat: Features,
  link: '/images/graphics/Features/Features5.svg'
});
insertGraphic.call({
  name: 'Features6',
  cat: Features,
  link: '/images/graphics/Features/Features6.svg'
});

insertGraphic.call({
  name: 'Cart',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Cart.svg'
});
insertGraphic.call({
  name: 'Cart-PopUp',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Cart-PopUp.svg'
});
insertGraphic.call({
  name: 'Checkout',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Checkout.svg'
});
insertGraphic.call({
  name: 'Completed',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Completed.svg'
});
insertGraphic.call({
  name: 'Delivery',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Delivery.svg'
});
insertGraphic.call({
  name: 'Item',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Item.svg'
});
insertGraphic.call({
  name: 'Item2',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Item2.svg'
});
insertGraphic.call({
  name: 'Paypal',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Paypal.svg'
});
insertGraphic.call({
  name: 'Products1',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Products1.svg'
});
insertGraphic.call({
  name: 'Products2',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Products2.svg'
});
insertGraphic.call({
  name: 'Products3',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Products3.svg'
});
insertGraphic.call({
  name: 'Rate',
  cat: ECommerce,
  link: '/images/graphics/ECommerce/Rate.svg'
});

insertGraphic.call({
  name: 'Blog1',
  cat: Blog,
  link: '/images/graphics/Blog/1.svg'
});
insertGraphic.call({
  name: 'Blog2',
  cat: Blog,
  link: '/images/graphics/Blog/2.svg'
});
insertGraphic.call({
  name: 'Blog3',
  cat: Blog,
  link: '/images/graphics/Blog/3.svg'
});
insertGraphic.call({
  name: 'Blog4',
  cat: Blog,
  link: '/images/graphics/Blog/4.svg'
});
insertGraphic.call({
  name: 'Blog5',
  cat: Blog,
  link: '/images/graphics/Blog/5.svg'
});
insertGraphic.call({
  name: 'Blog6',
  cat: Blog,
  link: '/images/graphics/Blog/6.svg'
});
insertGraphic.call({
  name: 'Blog7',
  cat: Blog,
  link: '/images/graphics/Blog/7.svg'
});
insertGraphic.call({
  name: 'Blog8',
  cat: Blog,
  link: '/images/graphics/Blog/8.svg'
});
insertGraphic.call({
  name: 'Blog9',
  cat: Blog,
  link: '/images/graphics/Blog/9.svg'
});
insertGraphic.call({
  name: 'Blog10',
  cat: Blog,
  link: '/images/graphics/Blog/10.svg'
});
insertGraphic.call({
  name: 'Blog11',
  cat: Blog,
  link: '/images/graphics/Blog/11.svg'
});
insertGraphic.call({
  name: 'Blog12',
  cat: Blog,
  link: '/images/graphics/Blog/12.svg'
});

insertGraphic.call({
  name: 'Article1',
  cat: Article,
  link: '/images/graphics/Article/1.svg'
});
insertGraphic.call({
  name: 'Article2',
  cat: Article,
  link: '/images/graphics/Article/2.svg'
});
insertGraphic.call({
  name: 'Article3',
  cat: Article,
  link: '/images/graphics/Article/3.svg'
});
insertGraphic.call({
  name: 'Article4',
  cat: Article,
  link: '/images/graphics/Article/4.svg'
});
insertGraphic.call({
  name: 'Article5',
  cat: Article,
  link: '/images/graphics/Article/5.svg'
});
insertGraphic.call({
  name: 'Article6',
  cat: Article,
  link: '/images/graphics/Article/6.svg'
});

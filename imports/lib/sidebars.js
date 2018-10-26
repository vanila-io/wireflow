export const openChat = () => {
  /* Open/close chat */
  document.getElementById('openCharts').onclick = function() {
    if (document.querySelector('.chartsSidebar-open')) {
      document.getElementById('chartsSide').className = 'col s1 chartsSidebar';
      document.getElementById('mainWrap').className = 'row';
    } else {
      document.getElementById('chartsSide').className += ' chartsSidebar-open';
      document.getElementById('mainWrap').className += ' mainPush';
    }
  };

  /* Open/close tabs menu */
  document.getElementById('openTabs').onclick = function() {
    if (document.querySelector('.tabWrapper-open')) {
      document.getElementById('tabsMenu').className = 'col s12 tabWrapper';
      document.getElementById('test1').className = 'col s12 mainCont';
    } else {
      document.getElementById('tabsMenu').className += ' tabWrapper-open';
      document.getElementById('test1').className += ' mainCont-push';
    }
  };

  /* Open/close right sidebar room permissions 
        document.getElementById('openPermissionsBtn').onclick=function(){
             if (document.querySelector(".rsmRoomPermissions-open")) {
               document.getElementById('rsmRoomPermissions').className = "rsmRoomPermissions";
             }else {
               document.getElementById('rsmRoomPermissions').className += " rsmRoomPermissions-open"
             }
        };*/

  /* Open/close right sidebar room chat 
        document.getElementById('openChatBtn').onclick=function(){
             if (document.querySelector(".rsmRoomChat-open")) {
               document.getElementById('rsmRoomChat').className = "rsmRoomChat";
             }else {
               document.getElementById('rsmRoomChat').className += " rsmRoomChat-open"
             }
        };*/

  /* Open/close right sidebar room chat 
        document.getElementById('openUsersBtn').onclick=function(){
             if (document.querySelector(".rsmRoomUsers-open")) {
               document.getElementById('rsmRoomUsers').className = "rsmRoomUsers";
             }else {
               document.getElementById('rsmRoomUsers').className += " rsmRoomUsers-open"
             }
        };*/

  /* Open/close right sidebar room chat 
        document.getElementById('openInfoBtn').onclick=function(){
             if (document.querySelector(".rsmRoomInfo-open")) {
               document.getElementById('rsmRoomInfo').className = "rsmRoomInfo";
             }else {
               document.getElementById('rsmRoomInfo').className += " rsmRoomInfo-open"
             }
        };*/
};

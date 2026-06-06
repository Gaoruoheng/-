App({
  onLaunch: function () {
    this.globalData = {
      env: "cloud1-d2ghz6vur81165183"
    };
    if (!wx.cloud) {
      console.error("Please upgrade WeChat client.");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
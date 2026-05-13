App({
  globalData: {
    user: null,
    cloudReady: false,
  },
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '提示', content: '当前微信版本不支持云开发，请升级微信。', showCancel: false });
      return;
    }
    wx.cloud.init({
      // 当前仓库默认绑定到已创建的云环境；如需切换，在微信开发者工具云开发面板复制环境 ID 后替换这里。
      env: 'cloudbase-d8gf7epro093b9038',
      traceUser: true,
    });
    this.globalData.cloudReady = true;
  },
});

module.exports = {
  // 正式上线前，把管理员微信 openid 填到这里；保持为空时没有任何人会自动成为管理员。
  // 获取方式：先让管理员打开一次小程序，云数据库 users 集合会生成待审核记录，复制该记录的 openid。
  adminOpenIds: [],
};

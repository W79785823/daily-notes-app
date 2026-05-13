async function callFunction(name, data = {}) {
  const result = await wx.cloud.callFunction({ name, data });
  if (result.result && result.result.error) throw new Error(result.result.error);
  return result.result || {};
}

function toastError(error, fallback) {
  wx.showToast({ title: (error && error.message) || fallback || '操作失败，请稍后重试', icon: 'none' });
}

module.exports = {
  callFunction,
  toastError,
};

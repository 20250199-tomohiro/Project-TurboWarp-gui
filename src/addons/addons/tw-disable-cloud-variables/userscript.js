export default async function ({ addon }) {
  const setCloud = (cloud) => {
    addon.tab.redux.dispatch({
      type: 'tw/SET_CLOUD',
      cloud
    });
  };
  setCloud(false);
  // 無効化したら、クラウド変数の既定値(有効)に戻す
  addon.self.addEventListener('disabled', () => setCloud(true));
  addon.self.addEventListener('reenabled', () => setCloud(false));
}

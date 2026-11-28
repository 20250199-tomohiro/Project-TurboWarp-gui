export default async function ({ addon }) {
  const setEnabled = (enabled) => {
    addon.tab.traps.vm.setCompilerOptions({
      enabled
    });
  };
  setEnabled(false);
  // 無効化したら、コンパイラの既定値(有効)に戻す
  addon.self.addEventListener('disabled', () => setEnabled(true));
  addon.self.addEventListener('reenabled', () => setEnabled(false));
}

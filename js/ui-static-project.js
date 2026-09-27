// Static controls are bound once from trusted application code.
uiBindStatic([
["click", "s0", function (event, uiValues) {
  openCommandPalette();
}],
["click", "s1", function (event, uiValues) {
  openInbox();
}],
["click", "s2", function (event, uiValues) {
  openIntake();
}],
["click", "s3", function (event, uiValues) {
  openDependencyRadar();
}],
["click", "s4", function (event, uiValues) {
  openAudit();
}],
["click", "s5", function (event, uiValues) {
  openAnalysis();
}],
["click", "s6", function (event, uiValues) {
  openIssues();
}],
["click", "s7", function (event, uiValues) {
  exportWorkspace();
}],
["click", "s8", function (event, uiValues) {
  exportCsv();
}],
["change", "s9", function (event, uiValues) {
  importWorkspace(event);
}],
["click", "s10", function (event, uiValues) {
  openTrash();
}],
["click", "s11", function (event, uiValues) {
  openProjectDrawer();
}],
["click", "s12", function (event, uiValues) {
  openTaskDrawer();
}],
["click", "s13", function (event, uiValues) {
  setView('table');
}],
["click", "s14", function (event, uiValues) {
  setView('board');
}],
["click", "s15", function (event, uiValues) {
  setView('timeline');
}],
["click", "s16", function (event, uiValues) {
  setView('calendar');
}],
["input", "s17", function (event, uiValues) {
  renderWorkspace();
}],
["change", "s18", function (event, uiValues) {
  renderWorkspace();
}],
["change", "s19", function (event, uiValues) {
  renderWorkspace();
}],
["change", "s20", function (event, uiValues) {
  renderWorkspace();
}],
["change", "s21", function (event, uiValues) {
  renderWorkspace();
}],
["change", "s22", function (event, uiValues) {
  renderWorkspace();
}],
["change", "s23", function (event, uiValues) {
  renderWorkspace();
}],
["click", "s24", function (event, uiValues) {
  setQuickFilter('');
}],
["click", "s25", function (event, uiValues) {
  setQuickFilter('today');
}],
["click", "s26", function (event, uiValues) {
  setQuickFilter('overdue');
}],
["click", "s27", function (event, uiValues) {
  setQuickFilter('week');
}],
["click", "s28", function (event, uiValues) {
  setQuickFilter('blocked');
}],
["click", "s29", function (event, uiValues) {
  setQuickFilter('approval');
}],
["click", "s30", function (event, uiValues) {
  setQuickFilter('highrisk');
}],
["click", "s31", function (event, uiValues) {
  setQuickFilter('pinned');
}],
["click", "s32", function (event, uiValues) {
  setQuickFilter('mine');
}],
["click", "s33", function (event, uiValues) {
  setQuickFilter('nodate');
}],
["change", "s34", function (event, uiValues) {
  applySavedView(this.value);
}],
["click", "s35", function (event, uiValues) {
  saveCurrentView();
}],
["click", "s36", function (event, uiValues) {
  deleteSavedView();
}],
["click", "s37", function (event, uiValues) {
  createFromTemplate();
}],
["keydown", "s38", function (event, uiValues) {
  if (event.key === 'Enter') quickAddTask();
}],
["click", "s39", function (event, uiValues) {
  quickAddTask();
}],
["click", "s40", function (event, uiValues) {
  setProjectFilter('active');
}],
["click", "s41", function (event, uiValues) {
  setProjectFilter('favorite');
}],
["click", "s42", function (event, uiValues) {
  setProjectFilter('archived');
}],
["click", "s43", function (event, uiValues) {
  selectProject('all');
}],
["click", "s44", function (event, uiValues) {
  applyBulk();
}],
["click", "s45", function (event, uiValues) {
  bulkDelete();
}],
["click", "s46", function (event, uiValues) {
  clearBulkSelection();
}],
["click", "s47", function (event, uiValues) {
  closeProjectDrawer();
}],
["click", "s48", function (event, uiValues) {
  deleteCurrentProject();
}],
["click", "s49", function (event, uiValues) {
  duplicateCurrentProject();
}],
["click", "s50", function (event, uiValues) {
  closeProjectDrawer();
}],
["click", "s51", function (event, uiValues) {
  saveProject();
}],
["click", "s52", function (event, uiValues) {
  closeTaskDrawer();
}],
["keydown", "s53", function (event, uiValues) {
  if (event.key === 'Enter') addComment();
}],
["click", "s54", function (event, uiValues) {
  addComment();
}],
["keydown", "s55", function (event, uiValues) {
  if (event.key === 'Enter') addActivity();
}],
["click", "s56", function (event, uiValues) {
  deleteCurrentTask();
}],
["click", "s57", function (event, uiValues) {
  duplicateCurrentTask();
}],
["click", "s58", function (event, uiValues) {
  closeTaskDrawer();
}],
["click", "s59", function (event, uiValues) {
  saveTask();
}],
["click", "s60", function (event, uiValues) {
  closeTrash();
}],
["click", "s61", function (event, uiValues) {
  emptyTrash();
}],
["click", "s62", function (event, uiValues) {
  closeTrash();
}],
["click", "s63", function (event, uiValues) {
  closeAudit();
}],
["click", "s64", function (event, uiValues) {
  closeAnalysis();
}],
["click", "s65", function (event, uiValues) {
  closeIssues();
}],
["click", "s66", function (event, uiValues) {
  closeInbox();
}],
["click", "s67", function (event, uiValues) {
  closeIntake();
}],
["click", "s68", function (event, uiValues) {
  closeIntake();
}],
["click", "s69", function (event, uiValues) {
  submitIntake();
}],
["click", "s70", function (event, uiValues) {
  closeProjectUpdate();
}],
["change", "s71", function (event, uiValues) {
  draftProjectUpdate();
}],
["click", "s72", function (event, uiValues) {
  draftProjectUpdate();
}],
["click", "s73", function (event, uiValues) {
  saveProjectUpdate();
}],
["click", "s74", function (event, uiValues) {
  closeDependencyRadar();
}],
["click", "s75", function (event, uiValues) {
  if (event.target === this) closeCommandPalette();
}],
["input", "s76", function (event, uiValues) {
  renderCommandPalette();
}],
["keydown", "s77", function (event, uiValues) {
  handleCommandKey(event);
}]
]);

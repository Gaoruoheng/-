Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    item: {
      type: Object,
      value: null
    }
  },

  methods: {
    noop() {},

    closePanel() {
      this.triggerEvent("close");
    },

    editItem() {
      this.triggerEvent("edit");
    },

    markStatus(e) {
      this.triggerEvent("statuschange", {
        status: e.currentTarget.dataset.status
      });
    }
  }
});

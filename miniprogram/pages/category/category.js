Page({
  data: {
    categories: ['Tops', 'Bottoms', 'Dresses', 'Accessories'],
    newCat: ''
  },
  
  onInput(e) {
    this.setData({ newCat: e.detail.value });
  },

  addCat() {
    const { newCat, categories } = this.data;
    if (!newCat.trim()) return;
    this.setData({
      categories: [...categories, newCat.trim()],
      newCat: ''
    });
    // TODO: 保存到数据库
  },

  deleteCat(e) {
    const index = e.currentTarget.dataset.index;
    const { categories } = this.data;
    categories.splice(index, 1);
    this.setData({ categories });
    // TODO: 同步删除到数据库
  }
});

const deleteProduct = (deleteReq) => {
   const prodId = deleteReq.productId;
   const csrf = deleteReq.csrf;
   const article = document.getElementById(prodId);

   fetch('/admin/product/' + prodId, {
      method: 'DELETE',
      headers: {
         'csrf-token': csrf
      }
   })
      .then(result => {
         // console.log(result);
         return result.json();
      })
      .then(data => {
         article.remove();
      })
      .catch(err => {
         console.log('Error:', err);
      });
};

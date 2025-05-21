document.getElementById('image').addEventListener('change', function(e) {
  const preview = document.getElementById('imagePreview');
  const existingImage = preview.querySelector('img');
  preview.innerHTML = '';
  const file = e.target.files[0];
  if (file) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  } else if (existingImage) {
    preview.appendChild(existingImage);
  }
});
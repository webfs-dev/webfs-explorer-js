import { encodePath, removeAllChildren } from '../utils.js';

// https://stackoverflow.com/a/38641281/943814
const naturalSorter = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});


const Directory = (state, root, dir, rootUrl, path, token) => {
  const dom = document.createElement('div');
  dom.classList.add('remfs-delver__directory');

  if (path.length > 0) {
    const parentPath = path.slice();
    parentPath.pop();
    const parentPlaceholder = {
      type: 'dir',
    };
    const listItem = ListItem({}, root, '..', parentPlaceholder, rootUrl, parentPath, token);
    const upDir = listItem.dom;
    dom.appendChild(upDir);
  }

  const items = {};

  const observeCallback = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const item = items[entry.target.dataset.filename];
        item.onVisible();
        observer.unobserve(entry.target);
      }
    });
  };

  const observeOptions = {
  };

  const observer = new IntersectionObserver(observeCallback, observeOptions);

  if (dir.children) {
    
    const sortedNames = Object.keys(dir.children).sort(naturalSorter.compare);

    for (const filename of sortedNames) {
      const child = dir.children[filename];
      const childPath = path.concat(filename);
      const listItem = ListItem(state.items[filename], root, filename, child, rootUrl, childPath, token)
      items[filename] = listItem;
      listItem.dom.dataset.filename = filename;
      const childEl = listItem.dom;
      observer.observe(childEl);
      dom.appendChild(childEl);

      //if (child.type === 'dir') {
      //  // greedily get all children 1 level down.
      //  if (!child.children) {
      //    fetch(rootUrl + encodePath(childPath) + '/remfs.json?access_token=' + token)
      //    .then(response => response.json())
      //    .then(remfs => {
      //      child.children = remfs.children;
      //    });
      //  }
      //}
    }
  }

  function onAddChild(name, child) {

    const sortedNames = Object.keys(dir.children).sort(naturalSorter.compare);

    let index = sortedNames.indexOf(name);

    if (index > -1) {
      const childPath = path.concat(name);
      const listItem = ListItem(state.items[name], root, name, child, rootUrl, childPath, token);
      dom.insertBefore(
        listItem.dom,
        dom.childNodes[index]);
    }
    else {
      throw new Error("Directory DOM insert fail");
    }
  }

  function onRemoveChild(name) {
    const sortedNames = Object.keys(dir.children).sort(naturalSorter.compare);

    let index = sortedNames.indexOf(name);

    if (index > -1) {
      if (path.length > 0) {
        index += 1;
      }
      dom.removeChild(dom.childNodes[index]);
    }
    else {
      throw new Error("Directory DOM removal fail");
    }
  }

  return { dom, onAddChild, onRemoveChild };
};

const ListItem = (state, root, filename, item, rootUrl, path, token) => {
  //const dom = document.createElement('a');
  const dom = document.createElement('div');
  dom.classList.add('remfs-delver__list-item');
  //dom.setAttribute('href', rootUrl + encodePath(path));

  let showPreview = false;

  const inner = document.createElement('div');
  inner.classList.add('remfs-delver__list-content');
  dom.appendChild(inner);

  const previewEl = document.createElement('div');
  previewEl.classList.add('preview');
  dom.appendChild(previewEl);

  if (filename !== '..') {
    const checkboxEl = document.createElement('input');
    checkboxEl.classList.add('remfs-delver__checkbox');
    checkboxEl.setAttribute('type', 'checkbox');
    checkboxEl.checked = state && state.selected;
    checkboxEl.addEventListener('click', (e) => {

      e.stopPropagation();

      if (checkboxEl.checked) {
        dom.dispatchEvent(new CustomEvent('item-selected', {
          bubbles: true,
          detail: {
            fsUrl: rootUrl,
            path,
            item,
          },
        }));
      }
      else {
        dom.dispatchEvent(new CustomEvent('item-deselected', {
          bubbles: true,
          detail: {
            fsUrl: rootUrl,
            path,
          },
        }));
      }
    });

    inner.appendChild(checkboxEl);
  }


  const iconContainerEl = document.createElement('span');
  iconContainerEl.classList.add('remfs-delver-list-item__icon-container');
  inner.appendChild(iconContainerEl);

  let thumbnailPromise;

  if (item.type === 'dir') {
    const iconEl = document.createElement('ion-icon');
    iconEl.name = 'folder';
    iconContainerEl.appendChild(iconEl);
  }
  else {
    const iconEl = document.createElement('ion-icon');
    iconEl.name = 'document';
    iconContainerEl.appendChild(iconEl);
  }

  const filenameEl = document.createElement('span');
  filenameEl.classList.add('remfs-delver__list-item-filename');
  filenameEl.innerText = filename;
  inner.appendChild(filenameEl);


  const itemControlsEl = document.createElement('span');
  itemControlsEl.classList.add('remfs-delver-item__controls');
  inner.appendChild(itemControlsEl);

  if (item.type === 'file') {
    itemControlsEl.appendChild(DownloadButton(rootUrl, path));
    itemControlsEl.appendChild(OpenExternalButton(rootUrl, path));
  }

  dom.addEventListener('click', (e) => {

    if (item.type === 'dir') {
      e.preventDefault();
      dom.dispatchEvent(new CustomEvent('select-dir', {
        bubbles: true,
        detail: {
          fsUrl: rootUrl,
          path,
        },
      }));
    }
    else {
      //e.preventDefault();

      showPreview = !showPreview;

      if (showPreview) {
        if (isImage(filename)) {
          previewEl.appendChild(ImagePreview(root, rootUrl, path, thumbnailPromise, token));
        }
      }
      else {
        removeAllChildren(previewEl);
      }
      //dom.setAttribute('target', '_blank');
    }
  });

  function onVisible() {
    const thumbUrl = rootUrl + '/.gemdrive/images/256' + encodePath(path);

    if (isImage(thumbUrl)) {
      const thumbEl = document.createElement('img');
      thumbEl.classList.add('remfs-delver__thumb');

      thumbnailPromise = fetch(thumbUrl + '?access_token=' + token)
      .then(response => response.blob());

      thumbnailPromise.then(blob => {
        const url = URL.createObjectURL(blob);
        thumbEl.src = url;
      })

      iconContainerEl.replaceChild(thumbEl, iconContainerEl.firstChild);
    }
  }

  return {
    dom,
    onVisible,
  };
};


const ImagePreview = (root, rootUrl, path, thumbnailPromise, token) => {

  const dom = document.createElement('div');
  dom.classList.add('remfs-delver__preview');

  const imageEl = document.createElement('img');
  imageEl.classList.add('remfs-delver__preview-image');
  dom.appendChild(imageEl);

  let loaded = false;

  if (thumbnailPromise) {
    thumbnailPromise.then((blob) => {
      if (!loaded) {
        const url = URL.createObjectURL(blob);
        imageEl.src = url;
      }
    });
  }

  const previewUrl = getPreviewUrl(root, rootUrl, path, dom);

  if (previewUrl) {
    fetch(previewUrl + '?access_token=' + token)
    .then(response => response.blob())
    .then(blob => {
      loaded = true;
      const url = URL.createObjectURL(blob);
      imageEl.src = url;
    })
  }

  return dom;
};


const OpenExternalButton = (rootUrl, path) => {
  const dom = document.createElement('a');
  dom.classList.add('remfs-delver-button');
  dom.classList.add('remfs-delver-open-external-button');
  dom.href = rootUrl + encodePath(path);
  dom.setAttribute('target', '_blank');
  const iconEl = document.createElement('ion-icon');
  iconEl.name = 'open';
  dom.appendChild(iconEl);

  const rootPath = new URL(rootUrl).pathname;

  let authPathStr = encodePath(path);
  if (rootPath !== '/') {
    authPathStr = decodeURIComponent(rootPath + '/' + authPathStr.slice(1));
  }

  return dom;
};

const DownloadButton = (rootUrl, path) => {
  const dom = document.createElement('a');
  dom.classList.add('remfs-delver-button');
  dom.classList.add('remfs-delver-download-button');
  dom.href = rootUrl + encodePath(path) + '?download=true';
  dom.setAttribute('target', '_blank');
  const iconEl = document.createElement('ion-icon');
  iconEl.name = 'download';
  dom.appendChild(iconEl);

  const rootPath = new URL(rootUrl).pathname;

  let authPathStr = encodePath(path);
  if (rootPath !== '/') {
    authPathStr = rootPath + '/' + authPathStr.slice(1);
  }

  return dom;
};

function getThumbUrl(root, rootUrl, path) {
  return getFileUrl(root, rootUrl, 'thumbnails', path);
}

function getPreviewUrl(root, rootUrl, path, parentEl) {

  let previewWidth = 512;

  if (window.innerWidth > 512) {
    previewWidth = 1024;
  }

  if (window.innerWidth > 1024) {
    previewWidth = 2048;
  }

  return rootUrl + `/.gemdrive/images/${previewWidth}${encodePath(path)}`;
  //return getFileUrl(root, rootUrl, 'previews', path);
}

function getFileUrl(root, rootUrl, type, path) {
  const filename = path[path.length - 1];
  if (isImage(filename) && root.children[type]) {
    let curItem = root.children[type];

    for (const part of path) {
      if (curItem.children) {
        curItem = curItem.children[part];
      }
      else {
        console.log("file not found");
        break;
      }
    }

    if (curItem) {
      const url = rootUrl + '/' + type + encodePath(path);
      return url;
    }
  }

  return null;
}


function isImage(pathStr) {
  const lower = pathStr.toLowerCase(pathStr);
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg');
}


export {
  Directory,
};

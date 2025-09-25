class SpriteSheetGenerator {
    constructor() {
        this.images = [];
        this.currentImageIndex = -1;
        // Template for custom point categories
        this.pointCategories = {}; // { categoryName: [{x, y}, ...] }
        this.selectedPoint = null; // Track currently selected point
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isPlaying = false; // Track play state
        this.playInterval = null; // Interval for playback
        this.playSpeed = 500; // Play speed in milliseconds
        this.mode = 'create'; // 'create' or 'edit'
        this.spriteSheetImage = null; // For edit mode
        this.xmlData = null; // For edit mode
        this.jsonData = null; // For edit mode
        this.magnifier = null; // Magnifier element
        this.magnifierCanvas = null; // Magnifier canvas
        this.magnifierCtx = null; // Magnifier canvas context
        this.magnifierCoords = null; // Magnifier coordinates display
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupPointControls();
        this.updateNavigation(); // Initialize navigation
        
        // Initialize magnifier elements
        this.magnifier = document.getElementById('magnifier');
        this.magnifierCanvas = document.getElementById('magnifierCanvas');
        this.magnifierCtx = this.magnifierCanvas.getContext('2d');
        this.magnifierCoords = document.getElementById('magnifierCoords');
    }

    setupEventListeners() {
        // Mode selection
        document.getElementById('createNewBtn').addEventListener('click', () => {
            this.setMode('create');
        });
        
        document.getElementById('editExistingBtn').addEventListener('click', () => {
            this.setMode('edit');
        });
        
        // Image upload
        document.getElementById('imageUpload').addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files);
        });
        
        // Edit mode file uploads
        document.getElementById('spriteSheetUpload').addEventListener('change', (e) => {
            this.handleSpriteSheetUpload(e.target.files[0]);
        });
        
        document.getElementById('xmlDataUpload').addEventListener('change', (e) => {
            this.handleXmlUpload(e.target.files[0]);
        });
        
        // Add JSON upload handler
        document.getElementById('jsonDataUpload').addEventListener('change', (e) => {
            this.handleJsonUpload(e.target.files[0]);
        });
        
        document.getElementById('loadDataBtn').addEventListener('click', () => {
            this.loadEditData();
        });
        
        // Custom category controls
        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            this.addCategory();
        });
        
        document.getElementById('categoryName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addCategory();
            }
        });

        // Canvas click for point placement
        this.canvas.addEventListener('click', (e) => {
            if (this.currentImageIndex === -1) return;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleCanvasClick(x, y);
        });

        // Mouse move for coordinates display and magnifier
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.currentImageIndex === -1) return;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Update magnifier
            this.updateMagnifier(x, y);
            
            if (this.selectedPoint) {
                const pointLabel = `${this.selectedPoint.category} Point ${this.selectedPoint.index + 1}`;
                document.getElementById('coordinatesDisplay').textContent = `Selected: ${pointLabel} - X: ${Math.round(x)}, Y: ${Math.round(y)} - Click to set`;
            } else {
                document.getElementById('coordinatesDisplay').textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
            }
        });
        
        // Show magnifier on mouse enter
        this.canvas.addEventListener('mouseenter', () => {
            if (this.currentImageIndex !== -1) {
                this.magnifier.style.display = 'block';
            }
        });
        
        // Hide magnifier on mouse leave
        this.canvas.addEventListener('mouseleave', () => {
            this.magnifier.style.display = 'none';
        });

        // Generate sprite sheet
        document.getElementById('generateBtn').addEventListener('click', () => {
            this.generateSpriteSheet();
        });

        // Export XML
        document.getElementById('exportXMLBtn').addEventListener('click', () => {
            this.exportXML();
        });
        
        // Export JSON
        document.getElementById('exportJSONBtn').addEventListener('click', () => {
            this.exportJSON();
        });

        // Frame navigation
        document.getElementById('prevBtn').addEventListener('click', () => {
            this.previousImage();
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            this.nextImage();
        });

        // Play button
        document.getElementById('playBtn').addEventListener('click', () => {
            this.startPlay();
        });
        
        // Stop button
        document.getElementById('stopBtn').addEventListener('click', () => {
            this.stopPlay();
        });
        
        // Play speed control
        document.getElementById('playSpeed').addEventListener('input', (e) => {
            const speed = parseInt(e.target.value);
            this.setPlaySpeed(speed);
            document.getElementById('speedValue').textContent = speed + 'ms';
        });
        
        // XML Import
        document.getElementById('importXMLBtn').addEventListener('click', () => {
            this.importXMLPositions();
        });

        // Point addition buttons (these will be dynamically created)
    }

    // Setup initial point controls
    setupPointControls() {
        // Initialize with no categories
        this.updateCategoryControls();
    }
    
    // Import XML positions
    importXMLPositions() {
        const xmlTextArea = document.getElementById('xmlImportArea');
        const xmlContent = xmlTextArea.value.trim();
        
        if (!xmlContent) {
            alert('Please paste XML content in the text area.');
            return;
        }
        
        try {
            // Parse the XML content
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                alert('Error parsing XML: Invalid XML format.');
                return;
            }
            
            // Find all positionsList elements
            const positionsLists = xmlDoc.querySelectorAll('positionsList');
            
            if (positionsLists.length === 0) {
                alert('No positionsList elements found in the XML.');
                return;
            }
            
            // First ensure we have images loaded
            if (this.images.length === 0) {
                alert('Please upload images first before importing XML positions.');
                return;
            }
            
            // Process each positionsList
            positionsLists.forEach(positionsList => {
                const name = positionsList.getAttribute('name');
                const data = positionsList.getAttribute('data');
                
                // Check if this position list is inside an enginePosition element
                let parentElement = positionsList.parentElement;
                let isEnginePosition = parentElement && parentElement.tagName === 'enginePosition';
                
                if (!name || !data) {
                    console.warn('positionsList without name or data attribute:', positionsList);
                    return;
                }
                
                // Parse the data string into coordinates
                const coordinates = this.parseCoordinateString(data);
                
                if (coordinates.length === 0) {
                    console.warn('No valid coordinates found for positionsList:', name);
                    return;
                }
                
                if (coordinates.length !== this.images.length) {
                    console.warn(`Coordinate count (${coordinates.length}) doesn't match image count (${this.images.length}) for ${name}`);
                    // We'll use what we have but may not assign to all images
                }
                
                // If this is an enginePosition, create a single 'engine' category
                // with multiple points per frame
                let categoryName = name;
                if (isEnginePosition) {
                    categoryName = 'engine';
                }
                
                // Create a new category if it doesn't exist
                if (!this.pointCategories[categoryName]) {
                    // Add new category with empty points array (will be populated based on coordinates)
                    this.pointCategories[categoryName] = [];
                    
                    // Add points to all images for the new category
                    this.images.forEach(imageData => {
                        if (!imageData.points[categoryName]) {
                            imageData.points[categoryName] = [];
                        }
                    });
                }
                
                // Add coordinates as points for this category
                // Each image in the sequence gets the corresponding point
                coordinates.forEach((point, index) => {
                    if (index < this.images.length) {
                        // Determine which point index this should be based on the name
                        // For engine positions, we'll use different indices for different names
                        let pointIndex = 0;
                        if (isEnginePosition) {
                            // For enginePosition elements, find all sibling positionsList elements 
                            // and assign each a unique point index based on their order
                            const allSiblings = Array.from(parentElement.querySelectorAll('positionsList'));
                            const nameOrder = allSiblings.map(el => el.getAttribute('name'));
                            pointIndex = nameOrder.indexOf(name);
                            
                            // If for some reason the name isn't found, default to 0
                            if (pointIndex === -1) {
                                pointIndex = 0;
                            }
                        }

                        // Make sure the point category template has enough points
                        while (this.pointCategories[categoryName].length <= pointIndex) {
                            this.pointCategories[categoryName].push({ x: 0, y: 0 });
                        }
                        
                        // Make sure the image's point array has enough points
                        if (!this.images[index].points[categoryName]) {
                            this.images[index].points[categoryName] = [];
                        }
                        
                        // Make sure the image has the required number of points
                        while (this.images[index].points[categoryName].length <= pointIndex) {
                            this.images[index].points[categoryName].push({ x: 0, y: 0 });
                        }
                        
                        // Set the coordinates for this point (store as relative coordinates from XML)
                        // These are relative to the center of the image (0,0 = center)
                        this.images[index].points[categoryName][pointIndex] = this.markAsImportedCoordinate({...point});
                    }
                });
            });
            
            // Update UI to reflect the new categories
            this.updateCategoryControls();
            this.updatePointControls();
            this.drawPoints();
            
            // Count unique categories created (not just position lists)
            const uniqueCategories = new Set(Array.from(positionsLists).map(positionsList => {
                const name = positionsList.getAttribute('name');
                let parentElement = positionsList.parentElement;
                if (parentElement && parentElement.tagName === 'enginePosition') {
                    return 'engine';
                }
                return name;
            }));
            
            alert(`Successfully imported data for ${uniqueCategories.size} categories from XML.`);
            
        } catch (error) {
            console.error('Error importing XML:', error);
            alert('Error importing XML: ' + error.message);
        }
    }
    
    // Parse coordinate string to array of points
    parseCoordinateString(data) {
        if (!data) return [];
        
        // Split the string by commas and convert to numbers
        const values = data.split(',').map(val => parseFloat(val.trim())).filter(val => !isNaN(val));
        
        // Group into pairs (x, y)
        const points = [];
        for (let i = 0; i < values.length; i += 2) {
            if (i + 1 < values.length) {
                // Convert negative coordinates to positive by finding the minimum values and offsetting
                points.push({ 
                    x: values[i], 
                    y: values[i + 1] 
                });
            }
        }
        
        return points;
    }

    // Add a new point category
    addCategory() {
        const categoryNameInput = document.getElementById('categoryName');
        const categoryName = categoryNameInput.value.trim();
        
        if (!categoryName) {
            alert('Please enter a category name.');
            return;
        }
        
        // Check if category already exists
        if (this.pointCategories[categoryName]) {
            alert('Category already exists.');
            return;
        }
        
        // Add new category with empty points array
        this.pointCategories[categoryName] = [];
        
        // Clear input
        categoryNameInput.value = '';
        
        // Add points to all images for the new category
        this.images.forEach(imageData => {
            if (!imageData.points[categoryName]) {
                imageData.points[categoryName] = [];
            }
        });
        
        // Update UI
        this.updateCategoryControls();
        this.updatePointControls();
        this.drawPoints();
    }
    
    // Remove a point category
    removeCategory(categoryName) {
        // Remove category from template
        delete this.pointCategories[categoryName];
        
        // Remove category from all images
        this.images.forEach(imageData => {
            delete imageData.points[categoryName];
        });
        
        // Update UI
        this.updateCategoryControls();
        this.updatePointControls();
        this.drawPoints();
    }
    
    // Add a point to a category
    addPointToCategory(categoryName) {
        // Add to template
        this.pointCategories[categoryName].push({ x: 0, y: 0 });
        
        // Add to all images
        this.images.forEach(imageData => {
            imageData.points[categoryName].push({ x: 0, y: 0 });
        });
        
        this.updatePointControls();
        this.updatePointInputs();
        this.drawPoints();
    }
    
    // Remove a point from a category
    removePointFromCategory(categoryName, pointIndex) {
        // Remove from template
        this.pointCategories[categoryName].splice(pointIndex, 1);
        
        // Remove from all images
        this.images.forEach(imageData => {
            imageData.points[categoryName].splice(pointIndex, 1);
        });
        
        this.updatePointControls();
        this.updatePointInputs();
        this.drawPoints();
    }
    
    // Update category controls UI
    updateCategoryControls() {
        const container = document.getElementById('categoriesContainer');
        
        // Create UI for each category that doesn't already exist in the container
        Object.keys(this.pointCategories).forEach(categoryName => {
            // Check if category already exists in UI
            const existingCategoryDiv = container.querySelector(`[data-category="${categoryName}"]`);
            if (!existingCategoryDiv) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'category-item';
                categoryDiv.setAttribute('data-category', categoryName);
                categoryDiv.innerHTML = `
                    <div class="category-header">
                        <div class="category-title">${categoryName}</div>
                        <button class="remove-category-btn" data-category="${categoryName}">Remove</button>
                    </div>
                    <div class="point-controls-header">
                        <button class="add-point-btn" data-category="${categoryName}">Add ${categoryName} Point</button>
                        <span class="point-count">Points: <span id="${categoryName}Count">0</span></span>
                    </div>
                    <div id="${categoryName}PointsContainer"></div>
                `;
                
                container.appendChild(categoryDiv);
            }
        });
        
        // Remove UI elements for categories that no longer exist
        const categoryElements = container.querySelectorAll('.category-item');
        categoryElements.forEach(element => {
            const categoryName = element.getAttribute('data-category');
            if (!this.pointCategories.hasOwnProperty(categoryName)) {
                element.remove();
            }
        });
        
        // Add event listeners for remove category buttons
        document.querySelectorAll('.remove-category-btn').forEach(button => {
            // Only add listener if it doesn't already have one
            if (!button.hasAttribute('data-listener-added')) {
                button.addEventListener('click', (e) => {
                    const categoryName = e.target.getAttribute('data-category');
                    this.removeCategory(categoryName);
                });
                button.setAttribute('data-listener-added', 'true');
            }
        });
        
        // Add event listeners for add point buttons
        document.querySelectorAll('.add-point-btn').forEach(button => {
            // Only add listener if it doesn't already have one
            if (!button.hasAttribute('data-listener-added')) {
                button.addEventListener('click', (e) => {
                    const categoryName = e.target.getAttribute('data-category');
                    this.addPointToCategory(categoryName);
                });
                button.setAttribute('data-listener-added', 'true');
            }
        });
    }

    setMode(mode) {
        this.mode = mode;
        
        // Update UI
        document.getElementById('createNewBtn').classList.toggle('active', mode === 'create');
        document.getElementById('editExistingBtn').classList.toggle('active', mode === 'edit');
        
        // Show/hide sections
        document.getElementById('uploadSection').style.display = mode === 'create' ? 'block' : 'none';
        document.getElementById('editSection').style.display = mode === 'edit' ? 'block' : 'none';
        
        // Reset data only if switching modes
        if (this.mode !== mode) {
            this.images = [];
            this.currentImageIndex = -1;
            this.spriteSheetImage = null;
            this.xmlData = null;
            this.jsonData = null; // Reset JSON data as well
            this.pointCategories = {}; // Reset point categories
            document.getElementById('imagePreview').innerHTML = '';
            document.getElementById('editPreview').innerHTML = '';
            
            // Reset canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Reset navigation
            this.updateNavigation();
            
            // Reset category controls
            this.updateCategoryControls();
        }
    }
    
    // Handle sprite sheet upload for edit mode
    handleSpriteSheetUpload(file) {
        if (!file || file.type !== 'image/png') {
            alert('Please select a PNG file.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.spriteSheetImage = img;
                this.showEditPreview();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    // Handle XML upload for edit mode
    handleXmlUpload(file) {
        if (!file || file.type !== 'text/xml' && !file.name.endsWith('.xml')) {
            alert('Please select an XML file.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parser = new DOMParser();
                this.xmlData = parser.parseFromString(e.target.result, 'text/xml');
                this.showEditPreview();
            } catch (error) {
                console.error('Error parsing XML:', error);
                alert('Error parsing XML file.');
            }
        };
        reader.readAsText(file);
    }
    
    // Handle JSON upload for edit mode
    handleJsonUpload(file) {
        if (!file || file.type !== 'application/json' && !file.name.endsWith('.json')) {
            alert('Please select a JSON file.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.jsonData = JSON.parse(e.target.result);
                this.showEditPreview();
            } catch (error) {
                console.error('Error parsing JSON:', error);
                alert('Error parsing JSON file.');
            }
        };
        reader.readAsText(file);
    }
    
    // Show preview of uploaded files in edit mode
    showEditPreview() {
        const previewContainer = document.getElementById('editPreview');
        previewContainer.innerHTML = '';
        
        if (this.spriteSheetImage) {
            const imgPreview = document.createElement('div');
            imgPreview.className = 'edit-preview-item';
            imgPreview.innerHTML = `
                <h4>Sprite Sheet Preview</h4>
                <img src="${this.spriteSheetImage.src}" alt="Sprite Sheet" style="max-width: 200px; max-height: 200px; border: 1px solid #ddd;">
                <p>PNG file loaded successfully</p>
            `;
            previewContainer.appendChild(imgPreview);
        }
        
        if (this.xmlData) {
            const xmlPreview = document.createElement('div');
            xmlPreview.className = 'edit-preview-item';
            xmlPreview.innerHTML = `
                <h4>XML Data Preview</h4>
                <pre style="max-height: 150px; overflow: auto; background: #f5f5f5; padding: 10px; border-radius: 4px;">
                    ${this.xmlData.documentElement.outerHTML.substring(0, 500)}...
                </pre>
                <p>XML file loaded successfully</p>
            `;
            previewContainer.appendChild(xmlPreview);
        }
        
        if (this.jsonData) {
            const jsonPreview = document.createElement('div');
            jsonPreview.className = 'edit-preview-item';
            jsonPreview.innerHTML = `
                <h4>JSON Data Preview</h4>
                <pre style="max-height: 150px; overflow: auto; background: #f5f5f5; padding: 10px; border-radius: 4px;">
                    ${JSON.stringify(this.jsonData, null, 2).substring(0, 500)}...
                </pre>
                <p>JSON file loaded successfully</p>
            `;
            previewContainer.appendChild(jsonPreview);
        }
    }

    // Load edit data and convert to application format
    loadEditData() {
        if (!this.spriteSheetImage || (!this.xmlData && !this.jsonData)) {
            alert('Please upload both sprite sheet PNG and data file (XML or JSON).');
            return;
        }
        
        try {
            let frames = [];
            
            // Parse XML or JSON data
            if (this.xmlData) {
                console.log('Starting to parse XML data...');
                
                // Log the entire XML structure for debugging
                const xmlString = new XMLSerializer().serializeToString(this.xmlData);
                console.log('Full XML content:', xmlString);
                
                // Parse XML data - try different possible root elements
                frames = this.xmlData.querySelectorAll('Frame');
                console.log('Direct Frame query found:', frames.length, 'frames');
                
                // If no frames found, try direct children of root
                if (frames.length === 0) {
                    console.log('Trying SpriteSheet > Frames > Frame structure...');
                    const spriteSheet = this.xmlData.querySelector('SpriteSheet');
                    if (spriteSheet) {
                        console.log('Found SpriteSheet element');
                        const framesContainer = spriteSheet.querySelector('Frames');
                        if (framesContainer) {
                            console.log('Found Frames container');
                            frames = framesContainer.querySelectorAll('Frame');
                            console.log('SpriteSheet > Frames > Frame found:', frames.length, 'frames');
                        }
                    }
                }
                
                // If still no frames, try direct children
                if (frames.length === 0) {
                    console.log('Trying Frames > Frame structure...');
                    const framesContainer = this.xmlData.querySelector('Frames');
                    if (framesContainer) {
                        console.log('Found Frames container');
                        frames = framesContainer.querySelectorAll('Frame');
                        console.log('Frames > Frame found:', frames.length, 'frames');
                    }
                }
                
                console.log('Total frames found:', frames.length);
                
                if (frames.length === 0) {
                    alert('No frames found in XML data. Please check your XML file structure.');
                    return;
                }
                
                // Log first frame details for debugging
                if (frames.length > 0) {
                    const firstFrame = frames[0];
                    console.log('First frame attributes:', {
                        id: firstFrame.getAttribute('id'),
                        name: firstFrame.getAttribute('name'),
                        x: firstFrame.getAttribute('x'),
                        y: firstFrame.getAttribute('y'),
                        width: firstFrame.getAttribute('width'),
                        height: firstFrame.getAttribute('height')
                    });
                    
                    const points = firstFrame.querySelector('Points');
                    if (points) {
                        console.log('First frame has Points element');
                        const laserPoints = points.querySelectorAll('LaserPoint');
                        const enginePoints = points.querySelectorAll('EnginePoint');
                        console.log('Laser points:', laserPoints.length, 'Engine points:', enginePoints.length);
                    } else {
                        console.log('First frame has no Points element');
                    }
                }
            } else if (this.jsonData) {
                console.log('Starting to parse JSON data...');
                console.log('Full JSON content:', this.jsonData);
                
                // Parse JSON data
                if (this.jsonData.frames && Array.isArray(this.jsonData.frames)) {
                    frames = this.jsonData.frames;
                    console.log('JSON frames found:', frames.length);
                } else {
                    alert('Invalid JSON structure. No frames found.');
                    return;
                }
                
                // Log first frame details for debugging
                if (frames.length > 0) {
                    const firstFrame = frames[0];
                    console.log('First frame:', firstFrame);
                }
            }
            
            // Create canvas to extract individual frames
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Process each frame
            this.images = [];
            
            if (this.xmlData) {
                // Process XML frames
                frames.forEach((frame, index) => {
                    const x = parseInt(frame.getAttribute('x')) || 0;
                    const y = parseInt(frame.getAttribute('y')) || 0;
                    const width = parseInt(frame.getAttribute('width')) || 0;
                    const height = parseInt(frame.getAttribute('height')) || 0;
                    const name = frame.getAttribute('name') || `frame_${index}.png`;
                    
                    console.log(`Processing frame ${index}:`, { x, y, width, height, name });
                    
                    // Validate dimensions
                    if (width <= 0 || height <= 0) {
                        console.warn(`Invalid dimensions for frame ${index}: ${width}x${height}`);
                        return;
                    }
                    
                    // Set canvas dimensions to frame size
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Extract frame from sprite sheet
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(this.spriteSheetImage, x, y, width, height, 0, 0, width, height);
                    
                    // Convert to data URL
                    const frameDataUrl = canvas.toDataURL('image/png');
                    
                    // Create image element
                    const img = new Image();
                    img.src = frameDataUrl;
                    
                    // Parse points - initialize with empty points object
                    const pointsData = {};
                    
                    const points = frame.querySelector('Points');
                    if (points) {
                        // Get all point elements
                        const pointElements = points.children;
                        
                        // Group points by category
                        for (let i = 0; i < pointElements.length; i++) {
                            const pointElement = pointElements[i];
                            const tagName = pointElement.tagName;
                            
                            // Extract category name (remove "Point" suffix)
                            const categoryName = tagName.replace(/Point$/, '');
                            
                            // Initialize category if not exists
                            if (!pointsData[categoryName]) {
                                pointsData[categoryName] = [];
                            }
                            
                            // Add point to category
                            pointsData[categoryName].push({
                                x: parseInt(pointElement.getAttribute('x')) || 0,
                                y: parseInt(pointElement.getAttribute('y')) || 0
                            });
                        }
                    }
                    
                    console.log(`Points for frame ${index}:`, pointsData);
                    
                    // Add to images array
                    this.images.push({
                        element: img,
                        name: name,
                        points: pointsData
                    });
                });
            } else if (this.jsonData) {
                // Process JSON frames
                frames.forEach((frame, index) => {
                    const x = frame.x || 0;
                    const y = frame.y || 0;
                    const width = frame.width || 0;
                    const height = frame.height || 0;
                    const name = frame.name || `frame_${index}.png`;
                    
                    console.log(`Processing frame ${index}:`, { x, y, width, height, name });
                    
                    // Validate dimensions
                    if (width <= 0 || height <= 0) {
                        console.warn(`Invalid dimensions for frame ${index}: ${width}x${height}`);
                        return;
                    }
                    
                    // Set canvas dimensions to frame size
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Extract frame from sprite sheet
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(this.spriteSheetImage, x, y, width, height, 0, 0, width, height);
                    
                    // Convert to data URL
                    const frameDataUrl = canvas.toDataURL('image/png');
                    
                    // Create image element
                    const img = new Image();
                    img.src = frameDataUrl;
                    
                    // Parse points - initialize with empty points object
                    const pointsData = {};
                    
                    if (frame.points) {
                        // Copy points from JSON structure
                        Object.keys(frame.points).forEach(categoryName => {
                            pointsData[categoryName] = [];
                            frame.points[categoryName].forEach(point => {
                                pointsData[categoryName].push({
                                    x: point.x || 0,
                                    y: point.y || 0
                                });
                            });
                        });
                    }
                    
                    console.log(`Points for frame ${index}:`, pointsData);
                    
                    // Add to images array
                    this.images.push({
                        element: img,
                        name: name,
                        points: pointsData
                    });
                });
            }
            
            console.log('Total images created:', this.images.length);
            
            // Initialize point categories based on first frame
            if (this.images.length > 0) {
                const firstFramePoints = this.images[0].points;
                this.pointCategories = {};
                
                // Copy categories from first frame
                Object.keys(firstFramePoints).forEach(categoryName => {
                    this.pointCategories[categoryName] = [...firstFramePoints[categoryName]];
                });
            } else {
                // Default to empty categories if no frames
                this.pointCategories = {};
            }
            
            console.log('Point categories initialized:', this.pointCategories);
            
            // Debug: Check images array
            console.log('Images array length:', this.images.length);
            console.log('Images array content:', this.images);
            
            // Store frame count for alert
            const frameCount = this.images.length;
            console.log('Frame count to display in alert:', frameCount);
            
            // Create previews immediately (don't wait for image loads)
            const previewContainer = document.getElementById('imagePreview');
            previewContainer.innerHTML = '';
            
            // Debug: Check if previewContainer exists
            console.log('Preview container:', previewContainer);
            
            // Create previews immediately
            if (this.images.length > 0) {
                this.images.forEach((imageData, imgIndex) => {
                    const preview = document.createElement('div');
                    preview.className = 'preview-image';
                    preview.innerHTML = `<img src="${imageData.element.src}" alt="Preview">`;
                    preview.addEventListener('click', () => {
                        this.selectImage(imgIndex, false); // fromPlay = false for manual navigation
                    });
                    previewContainer.appendChild(preview);
                });
            }
            
            // Update navigation
            this.updateNavigation();
            
            // Update category controls UI
            this.updateCategoryControls();
            
            // Manually switch to create mode UI without resetting data
            this.mode = 'create';
            document.getElementById('createNewBtn').classList.add('active');
            document.getElementById('editExistingBtn').classList.remove('active');
            document.getElementById('uploadSection').style.display = 'block';
            document.getElementById('editSection').style.display = 'none';
            
            // Select first image automatically AFTER switching to create mode
            if (this.images.length > 0) {
                // Wait for the first image to load before selecting it
                const firstImage = this.images[0].element;
                if (firstImage.complete && firstImage.naturalHeight !== 0) {
                    // Image is already loaded
                    this.selectImage(0, false);
                } else {
                    // Wait for image to load
                    firstImage.onload = () => {
                        this.selectImage(0, false);
                    };
                }
            }
            
            // Show alert with the actual number of frames
            alert(`Successfully loaded ${frameCount} frames for editing!`);
            
        } catch (error) {
            console.error('Error loading edit data:', error);
            alert('Error loading edit data. Please check your files and console for details.');
        }
    }

    handleImageUpload(files) {
        // Stop any playing animation
        if (this.isPlaying) {
            this.stopPlay();
        }
        
        this.images = [];
        const previewContainer = document.getElementById('imagePreview');
        previewContainer.innerHTML = '';

        // Filter only PNG files
        const pngFiles = Array.from(files).filter(file => file.type === 'image/png');

        if (pngFiles.length === 0) {
            alert('Please select at least one PNG image.');
            return;
        }

        let loadedCount = 0;
        const totalFiles = pngFiles.length;
        const imageElements = []; // Store image elements with their intended indices

        pngFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Store image with its intended index
                    imageElements[index] = {
                        element: img,
                        name: file.name,
                        points: {} // Initialize with empty points object
                    };

                    // Initialize points for each category
                    Object.keys(this.pointCategories).forEach(categoryName => {
                        imageElements[index].points[categoryName] = [];
                        // Initialize with empty points for this category
                        for (let i = 0; i < this.pointCategories[categoryName].length; i++) {
                            imageElements[index].points[categoryName].push({ x: 0, y: 0 });
                        }
                    });

                    // Check if all images are loaded
                    loadedCount++;
                    if (loadedCount === totalFiles) {
                        // Now that all images are loaded, add them to this.images in order
                        this.images = imageElements;
                        
                        // Create previews
                        previewContainer.innerHTML = '';
                        this.images.forEach((imageData, imgIndex) => {
                            const preview = document.createElement('div');
                            preview.className = 'preview-image';
                            preview.innerHTML = `<img src="${imageData.element.src}" alt="Preview">`;
                            preview.addEventListener('click', () => {
                                this.selectImage(imgIndex, false); // fromPlay = false for manual navigation
                            });
                            previewContainer.appendChild(preview);
                        });

                        // Select first image automatically
                        if (this.images.length > 0) {
                            this.selectImage(0, false);
                        }
                        
                        // Update navigation
                        this.updateNavigation();
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Initialize point structures for all images based on template
    initializePointStructures() {
        this.images.forEach(imageData => {
            // Initialize points for each category
            Object.keys(this.pointCategories).forEach(categoryName => {
                imageData.points[categoryName] = [];
                // Initialize with empty points for this category
                for (let i = 0; i < this.pointCategories[categoryName].length; i++) {
                    imageData.points[categoryName].push({ x: 0, y: 0 });
                }
            });
        });
    }

    selectImage(index, fromPlay = false) {
        // Stop play if it's running and not called from play interval
        if (this.isPlaying && !fromPlay) {
            this.stopPlay();
        }
        
        // Update UI
        const previews = document.querySelectorAll('.preview-image');
        previews.forEach((preview, i) => {
            if (i === index) {
                preview.classList.add('active');
            } else {
                preview.classList.remove('active');
            }
        });

        this.currentImageIndex = index;
        this.drawCurrentImage();
        this.loadPointsForImage(index);
        this.updateNavigation();
        this.updatePointControls();
        
        // Clear selected point when switching images
        this.selectedPoint = null;
        document.getElementById('coordinatesDisplay').textContent = 'X: 0, Y: 0';
    }

    drawCurrentImage() {
        if (this.currentImageIndex === -1 || this.images.length === 0) return;

        const img = this.images[this.currentImageIndex].element;
        
        // Set canvas dimensions to match the image
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw image at original size
        this.ctx.drawImage(img, 0, 0);
    }

    loadPointsForImage(index) {
        // Load points from image data
        const imageData = this.images[index];
        this.points = {};
        
        // Copy points for each category
        Object.keys(imageData.points).forEach(categoryName => {
            this.points[categoryName] = [...imageData.points[categoryName]];
        });

        this.updatePointInputs();
        this.drawPoints();
    }

    handleCanvasClick(x, y) {
        if (this.currentImageIndex === -1) return;
        
        // Ensure coordinates are integers
        const intX = Math.round(x);
        const intY = Math.round(y);
        
        const imageData = this.images[this.currentImageIndex];
        
        // If a point is selected, update its coordinates
        if (this.selectedPoint) {
            const categoryName = this.selectedPoint.category;
            const index = this.selectedPoint.index;
            
            // Update the point ONLY in the current image
            if (imageData.points[categoryName] && imageData.points[categoryName][index]) {
                // Determine if the original point was from XML import (relative coordinates)
                const originalPoint = imageData.points[categoryName][index];
                if (this.isPointImported(originalPoint)) {
                    // Convert absolute coordinates back to relative for storage
                    const relativePoint = this.convertAbsoluteToRelative({ x: intX, y: intY }, imageData.element);
                    // Preserve the imported tag
                    imageData.points[categoryName][index] = this.markAsImportedCoordinate({ x: relativePoint.x, y: relativePoint.y });
                } else {
                    // Store as absolute coordinates
                    imageData.points[categoryName][index] = { x: intX, y: intY };
                }
            }
            
            // Clear the selection after placing the point
            this.selectedPoint = null;
            this.updatePointControls();
            
            // Update display coordinates (show absolute coordinates to user)
            document.getElementById('coordinatesDisplay').textContent = `X: ${intX}, Y: ${intY}`;
        }
        
        this.drawPoints();
        this.updatePointInputs();
        this.updatePointControls();
    }

    updateSelectedPointCoordinates(imageData, x, y) {
        if (this.selectedPoint) {
            const categoryName = this.selectedPoint.category;
            const index = this.selectedPoint.index;
            
            // Update the point ONLY in the current image
            if (imageData.points[categoryName] && imageData.points[categoryName][index]) {
                imageData.points[categoryName][index] = { x, y };
            }
        }
    }

    updateImagePointData(imageData, x, y) {
        // Only update points if a point is actually selected
        // Do nothing if no point is selected
        return;
    }

    addLaserPoint() {
        // This method is deprecated - using custom categories instead
        console.warn('addLaserPoint is deprecated. Use addPointToCategory instead.');
    }

    addEnginePoint() {
        // This method is deprecated - using custom categories instead
        console.warn('addEnginePoint is deprecated. Use addPointToCategory instead.');
    }

    updatePointControls() {
        // Update counters for each category
        Object.keys(this.pointCategories).forEach(categoryName => {
            const countElement = document.getElementById(`${categoryName}Count`);
            if (countElement) {
                countElement.textContent = this.pointCategories[categoryName].length;
            }
        });
        
        // Update point control UI
        this.renderPointControls();
    }

    renderPointControls() {
        if (this.currentImageIndex === -1) return;
        
        const imageData = this.images[this.currentImageIndex];
        
        // Render point controls for each category
        Object.keys(this.pointCategories).forEach(categoryName => {
            const container = document.getElementById(`${categoryName}PointsContainer`);
            if (container) {
                container.innerHTML = '';
                
                // Only render controls for points that exist for this image
                if (imageData.points[categoryName]) {
                    imageData.points[categoryName].forEach((point, i) => {
                        if (point) {
                            // Get the coordinates to display
                            let displayX = point.x;
                            let displayY = point.y;
                            
                            // If it's an imported coordinate, show the absolute value for display
                            if (this.isPointImported(point)) {
                                const absolutePoint = this.convertRelativeToAbsolute(
                                    point, 
                                    imageData.element
                                );
                                displayX = Math.round(absolutePoint.x);
                                displayY = Math.round(absolutePoint.y);
                            }
                            
                            const control = this.createPointControl(
                                `${categoryName}point${i+1}`, 
                                `${categoryName} Point`, 
                                i, 
                                displayX, 
                                displayY, 
                                categoryName
                            );
                            container.appendChild(control);
                        }
                    });
                }
            }
        });
    }

    createPointControl(id, label, index, x, y, category) {
        const container = document.createElement('div');
        container.className = 'point-control';
        
        // Add selected class if this is the currently selected point
        if (this.selectedPoint && 
            this.selectedPoint.category === category && 
            this.selectedPoint.index === index) {
            container.classList.add('selected-point');
        }
        
        // Set appropriate min/max values based on current image dimensions if available
        let minVal = 0, maxVal = 1000;
        if (this.currentImageIndex !== -1 && this.images[this.currentImageIndex]) {
            const img = this.images[this.currentImageIndex].element;
            // Use image dimensions for min/max
            maxVal = Math.max(img.width, img.height, 1000);
            minVal = 0; // We'll display absolute coordinates to the user
        }
        
        container.innerHTML = `
            <span class="point-label">${label} ${index+1}:</span>
            <input type="range" id="${id}X" min="${minVal}" max="${maxVal}" value="${x}">
            <input type="number" id="${id}XNum" min="${minVal}" max="${maxVal}" value="${x}" step="1">
            <input type="range" id="${id}Y" min="${minVal}" max="${maxVal}" value="${y}">
            <input type="number" id="${id}YNum" min="${minVal}" max="${maxVal}" value="${y}" step="1">
            <button class="select-point-btn" data-point="${id}" data-category="${category}" data-index="${index}">Select</button>
            <button class="clear-point-btn" data-point="${id}">Clear</button>
        `;

        // Add event listeners for sliders
        const sliderX = container.querySelector(`#${id}X`);
        const numberX = container.querySelector(`#${id}XNum`);
        const sliderY = container.querySelector(`#${id}Y`);
        const numberY = container.querySelector(`#${id}YNum`);
        const selectBtn = container.querySelector(`.select-point-btn`);
        const clearBtn = container.querySelector(`.clear-point-btn`);

        sliderX.addEventListener('input', () => {
            numberX.value = sliderX.value;
            this.updatePointPosition(id, parseInt(sliderX.value), parseInt(sliderY.value));
        });

        numberX.addEventListener('input', () => {
            sliderX.value = numberX.value;
            this.updatePointPosition(id, parseInt(numberX.value), parseInt(sliderY.value));
        });

        sliderY.addEventListener('input', () => {
            numberY.value = sliderY.value;
            this.updatePointPosition(id, parseInt(sliderX.value), parseInt(sliderY.value));
        });

        numberY.addEventListener('input', () => {
            sliderY.value = numberY.value;
            this.updatePointPosition(id, parseInt(sliderX.value), parseInt(numberY.value));
        });

        // Button to select point
        selectBtn.addEventListener('click', () => {
            this.selectPoint(category, index);
        });

        // Button to clear point
        clearBtn.addEventListener('click', () => {
            this.clearPoint(id);
        });

        return container;
    }

    selectPoint(category, index) {
        this.selectedPoint = { category, index };
        this.updatePointControls(); // Re-render to show selected state
        
        // Show which point is selected
        const pointLabel = `${category} Point ${index + 1}`;
        document.getElementById('coordinatesDisplay').textContent = `Selected: ${pointLabel} - Click on image to set position`;
    }

    updatePointPosition(pointId, x, y) {
        // Ensure coordinates are integers
        const intX = Math.round(x);
        const intY = Math.round(y);
        
        // Update point data for current image
        if (this.currentImageIndex === -1) return;

        const imageData = this.images[this.currentImageIndex];
        
        // Extract category name from pointId (e.g., "Laserpoint1" -> "Laser")
        const category = pointId.replace(/point\d+.*$/, '');
        
        if (imageData.points[category]) {
            const index = parseInt(pointId.match(/\d+/)[0]) - 1;
            if (imageData.points[category][index]) {
                // Determine if this point originally came from XML import (relative coordinates)
                const originalPoint = imageData.points[category][index];
                if (this.isPointImported(originalPoint)) {
                    // Convert absolute coordinates back to relative for storage
                    const relativePoint = this.convertAbsoluteToRelative({ x: intX, y: intY }, imageData.element);
                    // Preserve the imported tag
                    imageData.points[category][index] = this.markAsImportedCoordinate({ x: relativePoint.x, y: relativePoint.y });
                } else {
                    // Store as absolute coordinates
                    imageData.points[category][index] = { x: intX, y: intY };
                }
            }
        }

        this.drawPoints();
    }

    setPointOnImage(pointId, x, y) {
        // Ensure coordinates are integers
        const intX = Math.round(x);
        const intY = Math.round(y);
        
        // Draw point on canvas
        const category = pointId.replace(/point\d+.*$/, '');
        const pointIndex = parseInt(pointId.match(/\d+/)[0]) - 1;
        this.drawPoint(intX, intY, category, pointIndex);
        
        // Update point data
        this.updatePointPosition(pointId, intX, intY);
    }

    clearPoint(pointId) {
        // We don't actually remove points, just reset their coordinates to 0,0
        // This maintains the template structure
        const numberX = document.getElementById(`${pointId}XNum`);
        const numberY = document.getElementById(`${pointId}YNum`);
        
        numberX.value = 0;
        numberY.value = 0;
        
        this.updatePointPosition(pointId, 0, 0);
    }

    updatePointInputs() {
        // This is now handled by renderPointControls
        this.renderPointControls();
    }

    drawPoint(x, y, category, index) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 6, 0, Math.PI * 2);
        
        // Highlight selected point
        let isSelected = false;
        if (this.selectedPoint) {
            isSelected = (this.selectedPoint.category === category && this.selectedPoint.index === index);
        }
        
        // Generate a color based on category name
        const categoryColors = {
            'Laser': 'red',
            'Engine': 'blue',
            'Weapon': 'orange',
            'Explosion': 'yellow',
            'Smoke': 'gray'
        };
        
        // Generate a color for unknown categories
        let color = categoryColors[category] || this.generateColorFromString(category);
        
        if (isSelected) {
            // Lighter color for selected point
            this.ctx.fillStyle = this.lightenColor(color);
        } else {
            this.ctx.fillStyle = color;
        }
        
        this.ctx.fill();
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Add a label
        this.ctx.fillStyle = 'white';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        // Use first letter of category + index for label
        const label = `${category.charAt(0)}${index+1}`;
        this.ctx.fillText(label, x, y);
        
        // Add extra highlight for selected point
        if (isSelected) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, 7, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'yellow';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }
    
    // Generate a color from a string
    generateColorFromString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(10)).substr(-2);
        }
        return color;
    }
    
    // Lighten a color
    lightenColor(color) {
        // Convert hex to RGB
        let r = parseInt(color.substr(1, 2), 16);
        let g = parseInt(color.substr(3, 2), 16);
        let b = parseInt(color.substr(5, 2), 16);
        
        // Lighten by 50%
        r = Math.min(255, r + (255 - r) * 0.5);
        g = Math.min(255, g + (255 - g) * 0.5);
        b = Math.min(255, b + (255 - b) * 0.5);
        
        // Convert back to hex
        return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
    }
    
    
    
    // Mark coordinates as imported from XML
    markAsImportedCoordinate(point) {
        // Add a special property to identify this as an imported coordinate
        if (point) {
            point.isRelative = true;  // Mark that this is relative to center
            return point;
        }
        return point;
    }
    
    // Check if a point was imported from XML using the special property
    isPointImported(point) {
        return point && point.isRelative === true;
    }
    
    // Convert relative coordinates to absolute image coordinates
    convertRelativeToAbsolute(point, img) {
        if (!img || !point) return { x: 0, y: 0 };
        
        // Center of the image
        const centerX = img.width / 2;
        const centerY = img.height / 2;
        
        // Convert relative coordinates to absolute
        const absoluteX = centerX + point.x;
        const absoluteY = centerY + point.y;
        
        return { x: absoluteX, y: absoluteY };
    }
    
    // Convert absolute coordinates back to relative for internal storage
    convertAbsoluteToRelative(absolutePoint, img) {
        if (!img || !absolutePoint) return { x: 0, y: 0 };
        
        // Center of the image
        const centerX = img.width / 2;
        const centerY = img.height / 2;
        
        // Convert absolute coordinates to relative
        const relativeX = absolutePoint.x - centerX;
        const relativeY = absolutePoint.y - centerY;
        
        return { x: relativeX, y: relativeY };
    }

    drawPoints() {
        this.drawCurrentImage(); // Redraw image to clear previous points

        if (this.currentImageIndex === -1) return;

        const imageData = this.images[this.currentImageIndex];
        
        // Draw points for each category
        Object.keys(imageData.points).forEach(categoryName => {
            if (imageData.points[categoryName]) {
                imageData.points[categoryName].forEach((point, i) => {
                    if (point) {
                        // Convert relative coordinates to absolute for drawing if needed
                        let drawX = point.x;
                        let drawY = point.y;
                        
                        if (this.isPointImported(point)) {
                            const absolutePoint = this.convertRelativeToAbsolute(point, imageData.element);
                            drawX = absolutePoint.x;
                            drawY = absolutePoint.y;
                        }
                        
                        this.drawPoint(drawX, drawY, categoryName, i);
                    }
                });
            }
        });
    }

    // Magnifier functionality
    updateMagnifier(x, y) {
        if (this.currentImageIndex === -1 || !this.magnifier || !this.magnifierCanvas) return;
        
        const imageData = this.images[this.currentImageIndex];
        const img = imageData.element;
        
        // Set magnifier canvas size
        this.magnifierCanvas.width = 150;
        this.magnifierCanvas.height = 150;
        
        // Clear magnifier canvas
        this.magnifierCtx.clearRect(0, 0, 150, 150);
        
        // Set zoom level (4x zoom)
        const zoom = 4;
        const magnifierSize = 150;
        const sourceSize = magnifierSize / zoom;
        
        // Calculate source rectangle with proper clamping to image boundaries
        // We need to ensure that the source area is always within the image bounds
        let sourceX = x - sourceSize / 2;
        let sourceY = y - sourceSize / 2;
        
        // Clamp source coordinates to image boundaries
        // This ensures we never try to read outside the image
        sourceX = Math.max(0, Math.min(img.width - sourceSize, sourceX));
        sourceY = Math.max(0, Math.min(img.height - sourceSize, sourceY));
        
        // Handle edge case where image is smaller than the magnifier view
        const actualSourceWidth = Math.min(sourceSize, img.width - sourceX);
        const actualSourceHeight = Math.min(sourceSize, img.height - sourceY);
        
        // Calculate the position of the mouse within the magnified view
        // This is where we'll draw the white dot
        const magnifiedMouseX = (x - sourceX) * zoom;
        const magnifiedMouseY = (y - sourceY) * zoom;
        
        // Only draw if we have a valid source area
        if (actualSourceWidth > 0 && actualSourceHeight > 0) {
            // Draw zoomed portion of image
            this.magnifierCtx.drawImage(
                img,
                sourceX, sourceY, actualSourceWidth, actualSourceHeight,  // Source rectangle
                0, 0, magnifierSize, magnifierSize         // Destination rectangle
            );
        }
        
        // Draw a white dot at the mouse position instead of crosshair
        this.magnifierCtx.beginPath();
        this.magnifierCtx.arc(magnifiedMouseX, magnifiedMouseY, 4, 0, Math.PI * 2);
        this.magnifierCtx.fillStyle = 'white';
        this.magnifierCtx.fill();
        this.magnifierCtx.strokeStyle = 'black';
        this.magnifierCtx.lineWidth = 2;
        this.magnifierCtx.stroke();
        
        // Update magnifier coordinates display
        this.magnifierCoords.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
    }

    // Frame navigation methods
    previousImage() {
        if (this.images.length > 0) {
            let newIndex;
            if (this.currentImageIndex > 0) {
                newIndex = this.currentImageIndex - 1;
            } else {
                // If at first frame, go to last frame
                newIndex = this.images.length - 1;
            }
            this.selectImage(newIndex, false); // fromPlay = false for manual navigation
        }
    }

    nextImage() {
        if (this.images.length > 0) {
            let newIndex;
            if (this.currentImageIndex < this.images.length - 1) {
                newIndex = this.currentImageIndex + 1;
            } else {
                // If at last frame, go to first frame
                newIndex = 0;
            }
            this.selectImage(newIndex, false); // fromPlay = false for manual navigation
        }
    }

    // Play functionality
    startPlay() {
        if (this.images.length === 0) return;
        
        // If already playing, stop first
        if (this.isPlaying) {
            this.stopPlay();
        }
        
        this.isPlaying = true;
        const playBtn = document.getElementById('playBtn');
        playBtn.innerHTML = '&#9724; Playing...'; // Change to playing indicator
        playBtn.classList.add('playing');
        
        // Make sure we have a valid play speed
        const speed = this.playSpeed || 500;
        
        console.log('Starting play interval with speed:', speed);
        this.playInterval = setInterval(() => {
            console.log('Playing next frame');
            // Call nextImage without stopping play
            if (this.images.length > 0) {
                let newIndex;
                if (this.currentImageIndex < this.images.length - 1) {
                    newIndex = this.currentImageIndex + 1;
                } else {
                    // If at last frame, go to first frame
                    newIndex = 0;
                }
                this.selectImage(newIndex, true); // fromPlay = true
            }
        }, speed);
    }

    stopPlay() {
        console.log('Stopping play');
        this.isPlaying = false;
        const playBtn = document.getElementById('playBtn');
        playBtn.innerHTML = '&#9658; Play'; // Change to play icon
        playBtn.classList.remove('playing');
        
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }

    // Method to set play speed
    setPlaySpeed(speed) {
        this.playSpeed = speed;
        // If currently playing, restart with new speed
        if (this.isPlaying) {
            this.stopPlay();
            this.startPlay();
        }
    }

    updateNavigation() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const frameInfo = document.getElementById('currentFrameInfo');
        
        if (this.images.length > 0 && this.currentImageIndex >= 0) {
            // Update frame info
            frameInfo.textContent = `Frame ${this.currentImageIndex + 1} of ${this.images.length}`;
            
            // Always enable navigation buttons for cycling
            prevBtn.disabled = false;
            nextBtn.disabled = false;
        } else {
            // Reset when no images
            frameInfo.textContent = 'Frame 0 of 0';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
        }
    }

    generateSpriteSheet() {
        if (this.images.length === 0) {
            alert('Please upload at least one image first.');
            return;
        }

        try {
            // Create a canvas for the sprite sheet
            const spriteCanvas = document.createElement('canvas');
            
            // Calculate dimensions for the sprite sheet
            const maxWidth = Math.max(...this.images.map(img => img.element.width));
            const totalHeight = this.images.reduce((sum, img) => sum + img.element.height, 0);
            
            // Set canvas dimensions
            spriteCanvas.width = maxWidth;
            spriteCanvas.height = totalHeight;
            
            const spriteCtx = spriteCanvas.getContext('2d');
            
            // Set high quality rendering
            spriteCtx.imageSmoothingEnabled = false; // For pixel-perfect rendering
            spriteCtx.webkitImageSmoothingEnabled = false;
            spriteCtx.mozImageSmoothingEnabled = false;
            spriteCtx.msImageSmoothingEnabled = false;
            
            // Set to transparent background
            spriteCtx.fillStyle = 'rgba(0, 0, 0, 0)';
            spriteCtx.fillRect(0, 0, spriteCanvas.width, spriteCanvas.height);
            
            // Draw all images onto the sprite sheet
            let currentY = 0;
            this.images.forEach((img, index) => {
                // Ensure the image is fully loaded before drawing
                if (img.element.complete && img.element.naturalHeight !== 0) {
                    spriteCtx.drawImage(img.element, 0, currentY);
                    currentY += img.element.height;
                } else {
                    console.warn(`Image at index ${index} is not fully loaded`);
                }
            });

            // Convert to blob with maximum quality and create download link
            spriteCanvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'sprite-sheet.png';
                    a.textContent = 'Download Sprite Sheet';
                    a.className = 'export-link';
                    
                    const container = document.getElementById('exportLinks');
                    container.innerHTML = '<h3>Sprite Sheet Generated:</h3>';
                    container.appendChild(a);
                    
                    // Also display the sprite sheet on the page
                    const img = document.createElement('img');
                    img.src = url;
                    img.style.maxWidth = '100%';
                    img.style.marginTop = '20px';
                    img.style.border = '1px solid #ddd';
                    container.appendChild(img);
                } else {
                    alert('Failed to generate sprite sheet.');
                }
            }, 'image/png', 1.0); // Maximum quality (1.0)
        } catch (error) {
            console.error('Error generating sprite sheet:', error);
            alert('An error occurred while generating the sprite sheet.');
        }
    }

    exportXML() {
        if (this.images.length === 0) {
            alert('Please upload at least one image first.');
            return;
        }

        try {
            // Create XML structure
            let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xmlContent += '<SpriteSheet>\n';
            xmlContent += `  <Metadata>\n`;
            xmlContent += `    <Generated>${new Date().toISOString()}</Generated>\n`;
            xmlContent += `    <FrameCount>${this.images.length}</FrameCount>\n`;
            xmlContent += `  </Metadata>\n`;
            
            // Add frame data
            xmlContent += '  <Frames>\n';
            let currentY = 0;
            this.images.forEach((img, index) => {
                // Ensure dimensions are integers
                const width = Math.round(img.element.width);
                const height = Math.round(img.element.height);
                const y = Math.round(currentY);
                
                xmlContent += `    <Frame id="${index}" name="${img.name}" x="0" y="${y}" width="${width}" height="${height}">\n`;
                
                // Add point data for each category
                xmlContent += '      <Points>\n';
                
                Object.keys(img.points).forEach(categoryName => {
                    if (img.points[categoryName]) {
                        img.points[categoryName].forEach((point, i) => {
                            if (point) {
                                // Ensure coordinates are integers
                                let intX = Math.round(point.x);
                                let intY = Math.round(point.y);
                                
                                // If the point was imported from XML (relative coordinates), \n                                // we need to convert it to absolute image coordinates\n                                if (this.isPointImported(point)) {\n                                    // Convert relative coordinates to absolute image coordinates\n                                    const absolutePoint = this.convertRelativeToAbsolute(point, img.element);\n                                    intX = Math.round(absolutePoint.x);\n                                    intY = Math.round(absolutePoint.y);\n                                }\n                                \n                                // Use the category name as the point type\n                                xmlContent += `        <${categoryName}Point id=\"${i+1}\" x=\"${intX}\" y=\"${intY}\" />\\n`;
                            }
                        });
                    }
                });
                
                xmlContent += '      </Points>\n';
                xmlContent += '    </Frame>\n';
                currentY += img.element.height;
            });
            xmlContent += '  <Frames>\n';
            xmlContent += '</SpriteSheet>';

            // Create download link
            const blob = new Blob([xmlContent], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sprite-data.xml';
            a.textContent = 'Download XML Data';
            a.className = 'export-link';
            
            const container = document.getElementById('exportLinks');
            const existingContent = container.innerHTML;
            container.innerHTML = existingContent + '<h3>XML Data Exported:</h3>';
            container.appendChild(a);
            
            // Also provide a preview of the XML
            const pre = document.createElement('pre');
            pre.textContent = xmlContent;
            pre.style.maxHeight = '200px';
            pre.style.overflow = 'auto';
            pre.style.backgroundColor = '#f5f5f5';
            pre.style.padding = '10px';
            pre.style.marginTop = '10px';
            container.appendChild(pre);
        } catch (error) {
            console.error('Error exporting XML:', error);
            alert('An error occurred while exporting the XML data.');
        }
    }

    exportJSON() {
        if (this.images.length === 0) {
            alert('Please upload at least one image first.');
            return;
        }

        try {
            // Create JSON structure
            const jsonData = {
                metadata: {
                    generated: new Date().toISOString(),
                    frameCount: this.images.length
                },
                frames: []
            };
            
            // Add frame data
            let currentY = 0;
            this.images.forEach((img, index) => {
                // Ensure dimensions are integers
                const width = Math.round(img.element.width);
                const height = Math.round(img.element.height);
                const y = Math.round(currentY);
                
                const frameData = {
                    id: index,
                    name: img.name,
                    x: 0,
                    y: y,
                    width: width,
                    height: height,
                    points: {}
                };
                
                // Add point data for each category
                Object.keys(img.points).forEach(categoryName => {
                    frameData.points[categoryName] = [];
                    if (img.points[categoryName]) {
                        img.points[categoryName].forEach((point, i) => {
                            if (point) {
                                // Ensure coordinates are integers
                                let intX = Math.round(point.x);
                                let intY = Math.round(point.y);
                                
                                // If the point was imported from XML (relative coordinates), 
                                // we need to convert it to absolute image coordinates
                                if (this.isPointImported(point)) {
                                    // Convert relative coordinates to absolute image coordinates
                                    const absolutePoint = this.convertRelativeToAbsolute(point, img.element);
                                    intX = Math.round(absolutePoint.x);
                                    intY = Math.round(absolutePoint.y);
                                }
                                
                                frameData.points[categoryName].push({
                                    id: i + 1,
                                    x: intX,
                                    y: intY
                                });
                            }
                        });
                    }
                });
                
                jsonData.frames.push(frameData);
                currentY += img.element.height;
            });

            // Convert to JSON string
            const jsonString = JSON.stringify(jsonData, null, 2);
            
            // Create download link
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sprite-data.json';
            a.textContent = 'Download JSON Data';
            a.className = 'export-link';
            
            const container = document.getElementById('exportLinks');
            const existingContent = container.innerHTML;
            container.innerHTML = existingContent + '<h3>JSON Data Exported:</h3>';
            container.appendChild(a);
            
            // Also provide a preview of the JSON
            const pre = document.createElement('pre');
            pre.textContent = jsonString;
            pre.style.maxHeight = '200px';
            pre.style.overflow = 'auto';
            pre.style.backgroundColor = '#f5f5f5';
            pre.style.padding = '10px';
            pre.style.marginTop = '10px';
            container.appendChild(pre);
        } catch (error) {
            console.error('Error exporting JSON:', error);
            alert('An error occurred while exporting the JSON data.');
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.spriteGenerator = new SpriteSheetGenerator();
});
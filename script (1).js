document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const searchInput = document.getElementById('pokemon-search');
    const searchResultsDiv = document.getElementById('search-results');
    const rosterSlots = document.querySelectorAll('.pokemon-slot');
    const teamCanvas = document.getElementById('team-canvas');
    const ctx = teamCanvas.getContext('2d');

    // Customization Controls
    const layoutRadios = document.querySelectorAll('input[name="layout"]');
    const bgColorInput = document.getElementById('background-color');
    const transparentBgCheckbox = document.getElementById('transparent-bg');
    const spriteStyleSelect = document.getElementById('sprite-style');
    const pokemonSizeSlider = document.getElementById('pokemon-size');
    const sizeValueSpan = document.getElementById('size-value');
    const teamNameInput = document.getElementById('team-name');
    const teamNameColorInput = document.getElementById('team-name-color');

    const exportBtn = document.getElementById('export-btn');

    // --- State Variables ---
    let team = []; // Array to hold { id, name, sprites: { default, shiny, artwork }, types: [...] }
    let customization = {
        layout: 'line',
        bgColor: '#f0f0f0',
        transparentBg: false,
        spriteStyle: 'front_default', // 'front_default', 'front_shiny', 'official-artwork'
        pokemonSizePercent: 100,
        teamName: '',
        teamNameColor: '#333333',
    };
    let loadedImages = {}; // Cache for loaded Image objects { pokemonId: { default: Image, shiny: Image, artwork: Image } }
    let pokemonList = []; // To store fetched full list for faster searching later

    // --- PokéAPI Base URL ---
    const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2/pokemon/';
    // Note: Official artwork URL structure needs verification - often requires external source or different API endpoint.
    // Example placeholder - this specific URL might not work directly.
    const OFFICIAL_ARTWORK_URL = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

    // --- Initialization ---
    fetchAllPokemonNames(); // Fetch names for faster search suggestions (optional)
    addEventListeners();
    drawTeamOnCanvas(); // Initial draw (empty)

    // --- Functions ---

    // Fetch all names (optional, improves search UX but initial load longer)
    async function fetchAllPokemonNames() {
        try {
            // Fetching a large limit to get most Pokémon names
            const response = await fetch(`${POKEAPI_BASE_URL}?limit=1000`);
            if (!response.ok) throw new Error('Network response was not ok.');
            const data = await response.json();
            pokemonList = data.results; // Stores { name, url }
            console.log(`Fetched ${pokemonList.length} Pokémon names.`);
        } catch (error) {
            console.error("Failed to fetch Pokémon list:", error);
            searchResultsDiv.innerHTML = `<p style="color: red;">Error loading Pokémon list.</p>`;
        }
    }

    // Search and Display Results
    let searchTimeout;
    function handleSearchInput() {
        clearTimeout(searchTimeout);
        const query = searchInput.value.toLowerCase().trim();
        searchResultsDiv.innerHTML = ''; // Clear previous results

        if (query.length < 2) {
            return; // Don't search for very short strings
        }

        searchResultsDiv.innerHTML = `<p>Searching...</p>`; // Feedback

        // Basic search filtering (can be improved)
        const filteredList = pokemonList
            .filter(p => p.name.includes(query))
            .slice(0, 10); // Limit results

        if (filteredList.length === 0 && query.length > 2) {
             // Debounce the direct API call
            searchTimeout = setTimeout(() => {
                fetchPokemonData(query, true); // Try fetching directly if not in list
            }, 500); // Wait 500ms after typing stops
        } else {
            filteredList.forEach(p => displaySearchResult(p.name));
             if (filteredList.length > 0) {
                searchResultsDiv.innerHTML = ''; // Clear 'Searching...'
                filteredList.forEach(p => displaySearchResult(p.name));
             } else {
                 searchResultsDiv.innerHTML = `<p>No matches found in list.</p>`;
             }
        }
    }

    async function displaySearchResult(pokemonName) {
        // Fetch minimal data just for the result display (sprite)
        try {
            const response = await fetch(`${POKEAPI_BASE_URL}${pokemonName}`);
            if (!response.ok) return; // Skip if Pokémon not found
            const data = await response.json();
            const spriteUrl = data.sprites?.front_default || 'placeholder.png'; // Fallback image?

            const item = document.createElement('div');
            item.classList.add('search-result-item');
            item.innerHTML = `
                <img src="${spriteUrl}" alt="${data.name}" loading="lazy">
                <span>${capitalize(data.name)}</span>
            `;
            item.addEventListener('click', () => addPokemonToTeam(pokemonName));
             // Ensure 'Searching...' text is removed before adding items
            if (searchResultsDiv.innerHTML.includes('<p>Searching...')) {
                searchResultsDiv.innerHTML = '';
            }
            searchResultsDiv.appendChild(item);

        } catch (error) {
            console.error("Error fetching sprite for search result:", error);
        }
    }

     // Fetch Full Pokemon Data
    async function fetchPokemonData(nameOrId, displayIfNotFound = false) {
        try {
            const response = await fetch(`${POKEAPI_BASE_URL}${nameOrId.toLowerCase()}`);
            if (!response.ok) {
                 if (displayIfNotFound) searchResultsDiv.innerHTML = `<p>Pokémon "${nameOrId}" not found.</p>`;
                throw new Error(`Pokemon ${nameOrId} not found`);
            }
            const data = await response.json();

            // Simplify the data structure we store
            const pokemonData = {
                id: data.id,
                name: data.name,
                sprites: {
                    default: data.sprites.front_default,
                    shiny: data.sprites.front_shiny,
                    // Attempt to get official artwork URL
                    artwork: OFFICIAL_ARTWORK_URL(data.id)
                },
                types: data.types.map(typeInfo => typeInfo.type.name)
            };

             // If called directly from search and not found in list, display it
            if (displayIfNotFound && !pokemonList.some(p => p.name === data.name)) {
                searchResultsDiv.innerHTML = ''; // Clear previous
                displaySearchResult(data.name);
            }

            return pokemonData;

        } catch (error) {
            console.error("Failed to fetch Pokémon data:", error);
            return null; // Indicate failure
        }
    }

    // Add Pokémon to Team
    async function addPokemonToTeam(nameOrId) {
        if (team.length >= 6) {
            alert("Your team is full (Max 6 Pokémon)!");
            return;
        }
        if (team.some(p => p.name === nameOrId || p.id === nameOrId)) {
             alert(`${capitalize(nameOrId)} is already in your team!`);
            return;
        }

        const pokemonData = await fetchPokemonData(nameOrId);
        if (!pokemonData) return; // Fetch failed

        team.push(pokemonData);
        searchInput.value = ''; // Clear search
        searchResultsDiv.innerHTML = ''; // Clear results
        updateRosterDisplay();
        preloadPokemonImages(pokemonData).then(drawTeamOnCanvas); // Preload then draw
    }

    // Remove Pokemon from Team
    function removePokemonFromTeam(index) {
        if (index >= 0 && index < team.length) {
            // Clear cached images for this pokemon to save memory (optional)
            if(loadedImages[team[index].id]) {
                delete loadedImages[team[index].id];
            }
            team.splice(index, 1);
            updateRosterDisplay();
            drawTeamOnCanvas();
        }
    }

    // Update Roster UI
    function updateRosterDisplay() {
        rosterSlots.forEach((slot, index) => {
            slot.innerHTML = ''; // Clear previous content
            slot.classList.remove('filled');
            slot.style.backgroundImage = ''; // Clear background image

            if (index < team.length) {
                const pokemon = team[index];
                slot.classList.add('filled');

                // Use background image for simple preview
                const previewSprite = pokemon.sprites.default || 'placeholder.png';
                slot.style.backgroundImage = `url(${previewSprite})`;

                 // Add remove button
                const removeBtn = document.createElement('button');
                removeBtn.classList.add('remove-pokemon-btn');
                removeBtn.innerHTML = '&times;'; // 'X' symbol
                removeBtn.title = `Remove ${capitalize(pokemon.name)}`;
                removeBtn.onclick = (event) => {
                    event.stopPropagation(); // Prevent potential slot click event
                    removePokemonFromTeam(index);
                };
                slot.appendChild(removeBtn);

            } else {
                slot.textContent = 'Empty'; // Restore 'Empty' text if needed
            }
        });
    }


     // Preload Images for Canvas Drawing
    function preloadPokemonImages(pokemonData) {
        const { id, sprites } = pokemonData;
        if (!loadedImages[id]) {
            loadedImages[id] = {};
        }

        const promises = [];

        // Function to load a single image source
        const loadImage = (src, type) => {
             // Skip if already loaded or src is null/undefined
             if (!src || loadedImages[id]?.[type]) {
                 return Promise.resolve(); // Resolve immediately if no src or already loaded
             }

            return new Promise((resolve, reject) => {
                const img = new Image();
                 // Handle potential CORS issues with artwork if not from same origin or allowed sources
                 // img.crossOrigin = "Anonymous"; // May be needed for canvas `toDataURL` if images are cross-origin
                img.onload = () => {
                    if (!loadedImages[id]) loadedImages[id] = {}; // Ensure nested object exists
                    loadedImages[id][type] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load image: ${src} for type ${type}`);
                    // Don't reject the whole batch, just resolve so drawing can continue (maybe draw placeholder?)
                     loadedImages[id][type] = null; // Mark as failed/unavailable
                    resolve();
                };
                img.src = src;
            });
        };

        // Load default, shiny, and artwork sprites
        promises.push(loadImage(sprites.default, 'default'));
        promises.push(loadImage(sprites.shiny, 'shiny'));
        promises.push(loadImage(sprites.artwork, 'artwork'));

        return Promise.all(promises);
    }


    // --- Canvas Drawing Logic ---
    async function drawTeamOnCanvas() {
        // Ensure all images for the current team are loaded before drawing
        const preloadPromises = team.map(p => preloadPokemonImages(p));
        await Promise.all(preloadPromises);

        // Clear canvas
        ctx.clearRect(0, 0, teamCanvas.width, teamCanvas.height);

        // Set background
        if (!customization.transparentBg) {
            ctx.fillStyle = customization.bgColor;
            ctx.fillRect(0, 0, teamCanvas.width, teamCanvas.height);
        } // Else: transparent background is default after clearRect

        // Determine Sprite/Image source based on selection
        let spriteKey = 'default'; // Default to 'front_default'
        if (customization.spriteStyle === 'front_shiny') spriteKey = 'shiny';
        else if (customization.spriteStyle === 'official-artwork') spriteKey = 'artwork';

        // Pokémon drawing properties
        const teamSize = team.length;
        if (teamSize === 0) return; // Nothing to draw

        const baseSize = 96; // Base pixel size of standard sprites
        const scale = customization.pokemonSizePercent / 100;
        const drawSize = baseSize * scale;
        let startX, startY, spacingX, spacingY;
        let cols, rows;

        // Calculate layout positions
        switch (customization.layout) {
            case 'grid-2x3':
                cols = 3;
                rows = 2;
                spacingX = (teamCanvas.width - cols * drawSize) / (cols + 1);
                spacingY = (teamCanvas.height - rows * drawSize) / (rows + 1);
                startX = spacingX;
                startY = spacingY;
                break;
            case 'grid-3x2':
                cols = 2;
                rows = 3;
                 spacingX = (teamCanvas.width - cols * drawSize) / (cols + 1);
                 // Adjust canvas height dynamically or check if it fits
                 const requiredHeightGrid3x2 = 3 * drawSize + 4 * 10; // Example spacing
                 if (teamCanvas.height < requiredHeightGrid3x2) {
                      // Maybe alert user or scale down? For now, just calculate spacing.
                      // teamCanvas.height = requiredHeightGrid3x2; // Cannot dynamically resize easily without redrawing page elements
                 }
                spacingY = (teamCanvas.height - rows * drawSize) / (rows + 1);
                startX = spacingX;
                startY = spacingY;
                break;
            case 'line': // Default to line
            default:
                cols = teamSize;
                rows = 1;
                spacingX = (teamCanvas.width - teamSize * drawSize) / (teamSize + 1);
                spacingY = 0; // Not used directly for Y positioning in line
                startX = spacingX;
                 // Center vertically
                startY = (teamCanvas.height - drawSize) / 2;
                break;
        }


        // Draw each Pokémon
        team.forEach((pokemon, index) => {
            const imgData = loadedImages[pokemon.id];
            let imgToDraw = imgData?.[spriteKey] || imgData?.default; // Fallback logic

            // Further fallback if even default failed or not loaded
            if (!imgToDraw || !(imgToDraw instanceof HTMLImageElement)) {
                 console.warn(`Image not available for ${pokemon.name} with style ${spriteKey}. Drawing placeholder.`);
                 // Draw a placeholder (e.g., red square)
                 ctx.fillStyle = 'red';
                 // Calculate position based on index and layout... (need positioning logic here too)
                 // ctx.fillRect(calculatedX, calculatedY, drawSize * 0.8, drawSize * 0.8); // Slightly smaller than sprite area
                 return; // Skip drawing this Pokémon image
            }


            let currentX, currentY;

             // Calculate position based on layout and index
            if (customization.layout.startsWith('grid')) {
                const row = Math.floor(index / cols);
                const col = index % cols;
                currentX = startX + col * (drawSize + spacingX);
                currentY = startY + row * (drawSize + spacingY);
            } else { // Line layout
                currentX = startX + index * (drawSize + spacingX);
                currentY = startY; // Vertically centered
            }


            // Draw the image
             try {
                 ctx.drawImage(imgToDraw, currentX, currentY, drawSize, drawSize);
             } catch (e) {
                 console.error("Error drawing image:", e, imgToDraw);
                 // Draw placeholder if drawImage fails unexpectedly
                 ctx.fillStyle = 'orange';
                 ctx.fillRect(currentX, currentY, drawSize, drawSize);
             }
        });

         // Draw Team Name
        if (customization.teamName) {
             // Basic text styling (can be expanded)
             const fontSize = Math.max(16, teamCanvas.width / 30); // Responsive-ish font size
             ctx.font = `bold ${fontSize}px ${getComputedStyle(document.body).fontFamily}`; // Use body font
             ctx.fillStyle = customization.teamNameColor;
             ctx.textAlign = 'center';
             ctx.textBaseline = 'bottom'; // Align to bottom edge

             // Position near the bottom center
             const textX = teamCanvas.width / 2;
             const textY = teamCanvas.height - 10; // 10px padding from bottom

             ctx.fillText(customization.teamName, textX, textY);
        }
    }

    // --- Event Listeners ---
    function addEventListeners() {
        searchInput.addEventListener('input', handleSearchInput);

        // Customization controls
        layoutRadios.forEach(radio => radio.addEventListener('change', (e) => {
            customization.layout = e.target.value;
            // Adjust canvas aspect ratio potentially? For now, just redraw.
             // Example: If switching to 3x2 grid, maybe suggest a taller canvas aspect ratio
             if (customization.layout === 'grid-3x2') {
                 // We might need to adjust canvas height logic or scaling if content overflows
                 // For simplicity, we redraw within existing bounds.
             }
             // Ensure canvas dimensions are suitable or adjust drawing scale within drawTeamOnCanvas
            drawTeamOnCanvas();
        }));

        bgColorInput.addEventListener('input', (e) => { // Use 'input' for live update
            customization.bgColor = e.target.value;
            if (!customization.transparentBg) drawTeamOnCanvas();
        });
        transparentBgCheckbox.addEventListener('change', (e) => {
            customization.transparentBg = e.target.checked;
             bgColorInput.disabled = e.target.checked; // Disable color picker if transparent
            drawTeamOnCanvas();
        });

        spriteStyleSelect.addEventListener('change', async (e) => {
            customization.spriteStyle = e.target.value;
            // Need to potentially preload the newly selected style for all team members
            await Promise.all(team.map(p => preloadPokemonImages(p)));
            drawTeamOnCanvas();
        });

        pokemonSizeSlider.addEventListener('input', (e) => {
            customization.pokemonSizePercent = parseInt(e.target.value, 10);
            sizeValueSpan.textContent = `${customization.pokemonSizePercent}%`;
            drawTeamOnCanvas();
        });

        teamNameInput.addEventListener('input', (e) => {
            customization.teamName = e.target.value;
            drawTeamOnCanvas(); // Redraw to show/update name
        });

         teamNameColorInput.addEventListener('input', (e) => {
            customization.teamNameColor = e.target.value;
             if (customization.teamName) drawTeamOnCanvas(); // Only redraw if there's a name
        });


        // Export Button
        exportBtn.addEventListener('click', () => {
            // Ensure canvas is up-to-date (optional, should be current if drawing on changes)
            // drawTeamOnCanvas();

            // Create temporary link
            const link = document.createElement('a');
            link.download = `${customization.teamName || 'pokemon-team'}.png`; // Filename
             // Get data URL (defaults to PNG)
            link.href = teamCanvas.toDataURL('image/png'); // Request PNG format
            link.click(); // Simulate click to trigger download
        });
    }

    // --- Utility Functions ---
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

}); // End DOMContentLoaded
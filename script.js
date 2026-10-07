import {
    FilesetResolver,
    ObjectDetector
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";

/* =========================================================
   STEP 45
   PERSON TRACKING + APPEARANCE RE-IDENTIFICATION
   + FIXED OBJECT STATUS DISPLAY
   + SEPARATE MOVEMENT PATH FOR EACH PERSON
   + PERSON ENTRY / EXIT TRACKING
   + LIVE OCCUPANCY STATISTICS
   + OCCUPANCY HISTORY
   + OCCUPANCY HISTORY ON WEBPAGE
   ========================================================= */

// -------------------- DOM ELEMENTS --------------------

const cameraVideo =
    document.getElementById("cameraVideo");

const detectionCanvas =
    document.getElementById("detectionCanvas");

const detectionCtx =
    detectionCanvas.getContext("2d");

const cameraMessage =
    document.getElementById("cameraMessage");

const cameraSelect =
    document.getElementById("cameraSelect");

const startCameraButton =
    document.getElementById("startCameraButton");

const gridCanvas =
    document.getElementById("gridCanvas");

const gridCtx =
    gridCanvas.getContext("2d");

const detectionStatus =
    document.getElementById("detectionStatus");

const occupancyStatus =
    document.getElementById("occupancyStatus");


// -------------------- CAMERA SETTINGS --------------------

const CAMERA_WIDTH = 600;
const CAMERA_HEIGHT = 450;

cameraVideo.width =
    CAMERA_WIDTH;

cameraVideo.height =
    CAMERA_HEIGHT;

detectionCanvas.width =
    CAMERA_WIDTH;

detectionCanvas.height =
    CAMERA_HEIGHT;


// -------------------- GRID SETTINGS --------------------

const GRID_COLS = 24;
const GRID_ROWS = 18;
const CELL_SIZE = 25;

gridCanvas.width =
    GRID_COLS * CELL_SIZE;

gridCanvas.height =
    GRID_ROWS * CELL_SIZE;


// -------------------- MEDIAPIPE --------------------

let objectDetector = null;

let lastVideoTime = -1;

let cameraStream = null;


// -------------------- TRACKING SETTINGS --------------------

const SCORE_THRESHOLD = 0.65;

const TRACKING_DISTANCE = 180;

const REQUIRED_STABLE_FRAMES = 3;

const MAX_MISSING_FRAMES = 20;

const APPEARANCE_THRESHOLD = 0.27;

const SIZE_THRESHOLD = 0.45;

const MAX_APPEARANCE_SAMPLES = 12;


// -------------------- PERSON DATA --------------------

let trackedPeople = [];

let rememberedPeople = [];

let nextPersonId = 1;

let pendingDetections = [];


// -------------------- APPEARANCE CANVAS --------------------

const appearanceCanvas =
    document.createElement("canvas");

appearanceCanvas.width = 8;

appearanceCanvas.height = 12;

const appearanceCtx =
    appearanceCanvas.getContext(
        "2d",
        {
            willReadFrequently: true
        }
    );


// =========================================================
// VISITED GRID CELLS
// =========================================================

let visitedCells = new Set();


// =========================================================
// STEP 41: SEPARATE MOVEMENT PATH
// =========================================================

let movementPaths =
    new Map();

const MIN_PATH_DISTANCE = 25;

const pathColors = [
    "#ff0000",
    "#0000ff",
    "#00aa00",
    "#ff8800",
    "#aa00aa",
    "#00aaaa",
    "#ff00aa",
    "#5555ff",
    "#008800",
    "#aa5500"
];


// =========================================================
// STEP 42: ENTRY / EXIT TRACKING
// =========================================================

let entryExitEvents = [];

let lastEntryExitMessage =
    "Waiting for people...";


// =========================================================
// STEP 43: LIVE STATISTICS
// =========================================================

let totalEntries = 0;

let totalExits = 0;

let maximumPeople = 0;


// =========================================================
// STEP 44: OCCUPANCY HISTORY
// =========================================================

let occupancyHistory = [];

let lastRecordedOccupancy = null;


// =========================================================
// STEP 43: CREATE DASHBOARD
// =========================================================

function createStatisticsPanel() {

    let panel =
        document.getElementById(
            "statisticsPanel"
        );


    if (panel) {
        return;
    }


    const statusContainer =
        document.querySelector(
            ".status"
        );


    if (!statusContainer) {

        console.error(
            "Status container not found"
        );

        return;
    }


    panel =
        document.createElement(
            "div"
        );


    panel.id =
        "statisticsPanel";


    panel.style.marginTop =
        "15px";


    panel.style.padding =
        "15px";


    panel.style.border =
        "2px solid #000000";


    panel.style.borderRadius =
        "8px";


    panel.style.backgroundColor =
    "#ffffff";

panel.style.color =
    "#000000";


    panel.style.fontFamily =
        "Arial";


    panel.style.fontSize =
        "15px";


    panel.style.lineHeight =
        "1.8";


    panel.style.width =
        "100%";


    panel.style.boxSizing =
        "border-box";


    panel.innerHTML = `

        <div
            style="
                font-size:18px;
                font-weight:bold;
                margin-bottom:8px;
            "
        >
            LIVE OCCUPANCY STATISTICS
        </div>

        <div id="currentPeopleStat">
            CURRENT PEOPLE : 0
        </div>

        <div id="maximumPeopleStat">
            MAX PEOPLE : 0
        </div>

        <div id="totalEntriesStat">
            TOTAL ENTRIES : 0
        </div>

        <div id="totalExitsStat">
            TOTAL EXITS : 0
        </div>

        <div id="occupancyPercentageStat">
            OCCUPANCY : 0%
        </div>
    `;


    statusContainer.appendChild(
        panel
    );
}


// =========================================================
// STEP 43: UPDATE DASHBOARD
// =========================================================

function updateStatistics(
    people
) {

    const currentPeople =
        people.length;


    if (
        currentPeople >
        maximumPeople
    ) {

        maximumPeople =
            currentPeople;
    }


    const currentOccupiedCells =
        new Set();


    for (
        const person of people
    ) {

        const gridPosition =
            cameraToGrid(
                person.cameraX,
                person.cameraY
            );


        const cellKey =
            `${gridPosition.x},${gridPosition.y}`;


        currentOccupiedCells.add(
            cellKey
        );
    }


    const occupancyPercentage =
        Math.round(

            (
                currentOccupiedCells.size /
                (
                    GRID_COLS *
                    GRID_ROWS
                )
            ) *
            100
        );


    const currentPeopleStat =
        document.getElementById(
            "currentPeopleStat"
        );


    const maximumPeopleStat =
        document.getElementById(
            "maximumPeopleStat"
        );


    const totalEntriesStat =
        document.getElementById(
            "totalEntriesStat"
        );


    const totalExitsStat =
        document.getElementById(
            "totalExitsStat"
        );


    const occupancyPercentageStat =
        document.getElementById(
            "occupancyPercentageStat"
        );


    if (currentPeopleStat) {

        currentPeopleStat.textContent =
            `CURRENT PEOPLE : ${currentPeople}`;
    }


    if (maximumPeopleStat) {

        maximumPeopleStat.textContent =
            `MAX PEOPLE : ${maximumPeople}`;
    }


    if (totalEntriesStat) {

        totalEntriesStat.textContent =
            `TOTAL ENTRIES : ${totalEntries}`;
    }


    if (totalExitsStat) {

        totalExitsStat.textContent =
            `TOTAL EXITS : ${totalExits}`;
    }


    if (occupancyPercentageStat) {

        occupancyPercentageStat.textContent =
            `OCCUPANCY : ${occupancyPercentage}%`;
    }
}


// =========================================================
// STEP 44: RECORD OCCUPANCY HISTORY
// =========================================================

function updateOccupancyHistory(
    people
) {

    const currentPeople =
        people.length;


    if (
        currentPeople ===
        lastRecordedOccupancy
    ) {

        return;
    }


    const historyEntry = {

        people:
            currentPeople,

        time:
            new Date()
                .toLocaleTimeString()
    };


    occupancyHistory.push(
        historyEntry
    );


    lastRecordedOccupancy =
        currentPeople;


    console.log(
        `STEP 44 OCCUPANCY CHANGED: ` +
        `${historyEntry.time} → ` +
        `${historyEntry.people} PEOPLE`
    );


    logOccupancyHistory();


    // STEP 45
    // Update occupancy history
    // visible on the webpage.

    updateOccupancyHistoryPanel();
}


// =========================================================
// STEP 44: DISPLAY COMPLETE HISTORY
// =========================================================

function logOccupancyHistory() {

    console.log(
        "===== STEP 44 OCCUPANCY HISTORY ====="
    );


    if (
        occupancyHistory.length === 0
    ) {

        console.log(
            "NO OCCUPANCY HISTORY"
        );

    } else {

        for (
            const entry of
            occupancyHistory
        ) {

            console.log(

                `${entry.time} → ` +
                `${entry.people} PEOPLE`
            );
        }
    }


    console.log(
        "======================================"
    );
}


// =========================================================
// STEP 45: CREATE OCCUPANCY HISTORY PANEL
// =========================================================

function createOccupancyHistoryPanel() {

    let panel =
        document.getElementById(
            "occupancyHistoryPanel"
        );


    if (panel) {
        return;
    }


    const statusContainer =
        document.querySelector(
            ".status"
        );


    if (!statusContainer) {

        console.error(
            "Status container not found"
        );

        return;
    }


    panel =
        document.createElement(
            "div"
        );


    panel.id =
        "occupancyHistoryPanel";


    // -----------------------------------------------------
    // STEP 45 VISIBILITY FIX
    // -----------------------------------------------------

    panel.style.display =
        "block";

    panel.style.visibility =
        "visible";

    panel.style.opacity =
        "1";

    panel.style.position =
        "relative";

    panel.style.zIndex =
        "9999";

    panel.style.clear =
        "both";

    panel.style.margin =
        "20px auto";

    panel.style.padding =
        "15px";

    panel.style.border =
        "2px solid #000000";

    panel.style.borderRadius =
        "8px";

    panel.style.backgroundColor =
        "#ffffff";

    panel.style.color =
        "#000000";

    panel.style.fontFamily =
        "Arial";

    panel.style.fontSize =
        "15px";

    panel.style.lineHeight =
        "1.8";

    panel.style.width =
        "calc(100% - 40px)";

    panel.style.maxWidth =
        "1200px";

    panel.style.minHeight =
        "80px";

    panel.style.boxSizing =
        "border-box";


    panel.innerHTML = `

        <div
            style="
                font-size:20px;
                font-weight:bold;
                margin-bottom:10px;
                color:#000000;
            "
        >
            OCCUPANCY HISTORY
        </div>

        <div
            id="occupancyHistoryList"
            style="
                color:#000000;
                display:block;
            "
        >
            No occupancy history yet.
        </div>
    `;


    // -----------------------------------------------------
    // PLACE PANEL DIRECTLY BELOW STATUS
    // -----------------------------------------------------

    statusContainer.parentNode.insertBefore(

        panel,

        statusContainer.nextSibling
    );


    console.log(
        "STEP 45: Occupancy History panel created"
    );


    updateOccupancyHistoryPanel();
}


// =========================================================
// STEP 45: UPDATE OCCUPANCY HISTORY PANEL
// =========================================================

function updateOccupancyHistoryPanel() {

    const historyList =
        document.getElementById(
            "occupancyHistoryList"
        );


    if (!historyList) {

        console.error(
            "STEP 45: Occupancy history list not found"
        );

        return;
    }


    if (
        occupancyHistory.length === 0
    ) {

        historyList.textContent =
            "No occupancy history yet.";

        return;
    }


    historyList.innerHTML = "";


    for (
        const entry of
        occupancyHistory
    ) {

        const historyRow =
            document.createElement(
                "div"
            );


        historyRow.style.display =
            "block";


        historyRow.style.padding =
            "5px 0";


        historyRow.style.borderBottom =
            "1px solid #dddddd";


        historyRow.style.color =
            "#000000";


        const personText =
            entry.people === 1
                ? "PERSON"
                : "PEOPLE";


        historyRow.textContent =
            `${entry.time} → ` +
            `${entry.people} ${personText}`;


        historyList.appendChild(
            historyRow
        );
    }
}


// =========================================================
// UTILITY FUNCTIONS
// =========================================================

function clamp(
    value,
    min,
    max
) {

    return Math.max(
        min,
        Math.min(
            max,
            value
        )
    );
}


function distance(
    x1,
    y1,
    x2,
    y2
) {

    return Math.sqrt(

        Math.pow(
            x1 - x2,
            2
        ) +

        Math.pow(
            y1 - y2,
            2
        )
    );
}


function getSizeRatio(
    box
) {

    return (
        box.width *
        box.height
    );
}


function sizeDifference(
    box1,
    box2
) {

    const size1 =
        getSizeRatio(
            box1
        );

    const size2 =
        getSizeRatio(
            box2
        );


    if (
        size1 === 0 ||
        size2 === 0
    ) {

        return 1;
    }


    return Math.abs(
        size1 - size2
    ) /
    Math.max(
        size1,
        size2
    );
}


// =========================================================
// STEP 42: ENTRY
// =========================================================

function recordEntry(
    person
) {

    const message =
        `PERSON ${person.id} ENTERED`;


    lastEntryExitMessage =
        message;


    totalEntries++;


    entryExitEvents.push({

        type:
            "ENTERED",

        personId:
            person.id,

        message:
            message,

        time:
            new Date()
                .toLocaleTimeString()
    });


    console.log(
        message
    );
}


// =========================================================
// STEP 42: EXIT
// =========================================================

function recordExit(
    person
) {

    const message =
        `PERSON ${person.id} EXITED`;


    lastEntryExitMessage =
        message;


    totalExits++;


    entryExitEvents.push({

        type:
            "EXITED",

        personId:
            person.id,

        message:
            message,

        time:
            new Date()
                .toLocaleTimeString()
    });


    console.log(
        message
    );
}


// =========================================================
// APPEARANCE SIGNATURE
// =========================================================

function getAppearanceSignature(
    detection
) {

    if (
        !cameraVideo.videoWidth ||
        !cameraVideo.videoHeight
    ) {

        return null;
    }


    const x =
        clamp(
            Math.floor(
                detection.boxX
            ),
            0,
            cameraVideo.videoWidth - 1
        );


    const y =
        clamp(
            Math.floor(
                detection.boxY
            ),
            0,
            cameraVideo.videoHeight - 1
        );


    const width =
        clamp(
            Math.floor(
                detection.width
            ),
            1,
            cameraVideo.videoWidth - x
        );


    const height =
        clamp(
            Math.floor(
                detection.height
            ),
            1,
            cameraVideo.videoHeight - y
        );


    try {

        appearanceCtx.clearRect(
            0,
            0,
            appearanceCanvas.width,
            appearanceCanvas.height
        );


        appearanceCtx.drawImage(

            cameraVideo,

            x,
            y,

            width,
            height,

            0,
            0,

            appearanceCanvas.width,
            appearanceCanvas.height
        );


        const imageData =
            appearanceCtx.getImageData(

                0,
                0,

                appearanceCanvas.width,
                appearanceCanvas.height
            );


        const data =
            imageData.data;


        const signature = [];


        for (
            let i = 0;
            i < data.length;
            i += 4
        ) {

            signature.push(
                data[i] / 255
            );

            signature.push(
                data[i + 1] / 255
            );

            signature.push(
                data[i + 2] / 255
            );
        }


        signature.push(

            clamp(
                width / height,
                0,
                3
            ) / 3
        );


        return signature;


    } catch (error) {

        console.error(
            "Appearance signature error:",
            error
        );

        return null;
    }
}


// =========================================================
// APPEARANCE COMPARISON
// =========================================================

function appearanceDistance(
    signature1,
    signature2
) {

    if (
        !signature1 ||
        !signature2
    ) {

        return 1;
    }


    const length =
        Math.min(

            signature1.length,
            signature2.length
        );


    if (length === 0) {

        return 1;
    }


    let totalDifference =
        0;


    for (
        let i = 0;
        i < length;
        i++
    ) {

        totalDifference +=
            Math.abs(

                signature1[i] -
                signature2[i]
            );
    }


    return (
        totalDifference /
        length
    );
}


function addAppearanceSample(
    person,
    signature
) {

    if (!signature) {
        return;
    }


    person.appearanceSamples.push(
        signature
    );


    if (
        person.appearanceSamples.length >
        MAX_APPEARANCE_SAMPLES
    ) {

        person.appearanceSamples.shift();
    }
}


function getBestAppearanceDistance(
    person,
    signature
) {

    if (
        !person.appearanceSamples ||
        person.appearanceSamples.length === 0 ||
        !signature
    ) {

        return 1;
    }


    let bestDistance =
        Infinity;


    for (
        const storedSignature
        of person.appearanceSamples
    ) {

        const currentDistance =
            appearanceDistance(

                signature,

                storedSignature
            );


        if (
            currentDistance <
            bestDistance
        ) {

            bestDistance =
                currentDistance;
        }
    }


    return bestDistance;
}


// =========================================================
// CREATE PERSON
// =========================================================

function createPerson(
    detection,
    signature
) {

    const person = {

        id:
            nextPersonId++,

        cameraX:
            detection.cameraX,

        cameraY:
            detection.cameraY,

        boxX:
            detection.boxX,

        boxY:
            detection.boxY,

        width:
            detection.width,

        height:
            detection.height,

        missingFrames:
            0,

        appearanceSamples:
            []
    };


    addAppearanceSample(
        person,
        signature
    );


    rememberedPeople.push(
        person
    );


    return person;
}


// =========================================================
// UPDATE PERSON
// =========================================================

function updatePerson(
    person,
    detection,
    signature
) {

    person.cameraX =
        person.cameraX * 0.65 +
        detection.cameraX * 0.35;


    person.cameraY =
        person.cameraY * 0.65 +
        detection.cameraY * 0.35;


    person.boxX =
        person.boxX * 0.65 +
        detection.boxX * 0.35;


    person.boxY =
        person.boxY * 0.65 +
        detection.boxY * 0.35;


    person.width =
        person.width * 0.65 +
        detection.width * 0.35;


    person.height =
        person.height * 0.65 +
        detection.height * 0.35;


    person.missingFrames =
        0;


    addAppearanceSample(
        person,
        signature
    );
}


// =========================================================
// PROCESS DETECTIONS
// =========================================================

function processDetections(
    result
) {

    const detections = [];


    if (
        !result ||
        !result.detections
    ) {

        return detections;
    }


    for (
        const detection of
        result.detections
    ) {

        if (
            !detection.categories ||
            detection.categories.length === 0
        ) {

            continue;
        }


        const category =
            detection.categories[0];


        const categoryName =
            category.categoryName
                ?.toLowerCase();


        const score =
            category.score ?? 0;


        if (
            categoryName !==
            "person"
        ) {

            continue;
        }


        if (
            score <
            SCORE_THRESHOLD
        ) {

            continue;
        }


        const box =
            detection.boundingBox;


        if (!box) {
            continue;
        }


        const width =
            box.width;

        const height =
            box.height;


        if (
            width < 40 ||
            height < 60
        ) {

            continue;
        }


        const cameraX =
            box.originX +
            width / 2;


        const cameraY =
            box.originY +
            height * 0.85;


        detections.push({

            boxX:
                box.originX,

            boxY:
                box.originY,

            width,

            height,

            cameraX,

            cameraY,

            score
        });
    }


    return detections;
}


// =========================================================
// FIND ACTIVE PERSON
// =========================================================

function findBestActivePerson(
    detection,
    signature,
    usedPersonIds
) {

    let bestPerson =
        null;

    let bestScore =
        Infinity;


    for (
        const person of
        trackedPeople
    ) {

        if (
            usedPersonIds.has(
                person.id
            )
        ) {

            continue;
        }


        const positionDistance =
            distance(

                detection.cameraX,
                detection.cameraY,

                person.cameraX,
                person.cameraY
            );


        if (
            positionDistance >
            TRACKING_DISTANCE
        ) {

            continue;
        }


        const sizeDiff =
            sizeDifference(
                detection,
                person
            );


        const appearanceDiff =
            getBestAppearanceDistance(

                person,

                signature
            );


        const combinedScore =
            positionDistance +
            appearanceDiff * 250 +
            sizeDiff * 100;


        if (
            combinedScore <
            bestScore
        ) {

            bestScore =
                combinedScore;

            bestPerson =
                person;
        }
    }


    return bestPerson;
}


// =========================================================
// FIND REMEMBERED PERSON
// =========================================================

function findRememberedPerson(
    detection,
    signature,
    usedPersonIds
) {

    let bestPerson =
        null;

    let bestScore =
        Infinity;


    for (
        const person of
        rememberedPeople
    ) {

        if (
            usedPersonIds.has(
                person.id
            )
        ) {

            continue;
        }


        const appearanceDiff =
            getBestAppearanceDistance(

                person,

                signature
            );


        if (
            appearanceDiff >
            APPEARANCE_THRESHOLD
        ) {

            continue;
        }


        const sizeDiff =
            sizeDifference(
                detection,
                person
            );


        const combinedScore =
            appearanceDiff +
            sizeDiff * 0.15;


        if (
            combinedScore <
            bestScore
        ) {

            bestScore =
                combinedScore;

            bestPerson =
                person;
        }
    }


    return bestPerson;
}


// =========================================================
// PENDING DETECTION
// =========================================================

function findPendingDetection(
    detection,
    signature
) {

    let bestPending =
        null;

    let bestScore =
        Infinity;


    for (
        const pending of
        pendingDetections
    ) {

        const positionDistance =
            distance(

                detection.cameraX,
                detection.cameraY,

                pending.cameraX,
                pending.cameraY
            );


        if (
            positionDistance >
            150
        ) {

            continue;
        }


        const appearanceDiff =
            appearanceDistance(

                signature,

                pending.signature
            );


        const score =
            positionDistance +
            appearanceDiff * 200;


        if (
            score <
            bestScore
        ) {

            bestScore =
                score;

            bestPending =
                pending;
        }
    }


    return bestPending;
}


function removeNearbyPending(
    detection
) {

    pendingDetections =
        pendingDetections.filter(
            pending => {

                const d =
                    distance(

                        detection.cameraX,
                        detection.cameraY,

                        pending.cameraX,
                        pending.cameraY
                    );


                return d > 100;
            }
        );
}


// =========================================================
// MAIN TRACKING FUNCTION
// =========================================================

function updatePersonTracking(
    detections
) {

    const result = [];

    const usedPersonIds =
        new Set();


    const preparedDetections =
        detections.map(
            detection => {

                return {

                    ...detection,

                    signature:
                        getAppearanceSignature(
                            detection
                        )
                };
            }
        );


    // -----------------------------------------------------
    // MATCH ACTIVE PEOPLE
    // -----------------------------------------------------

    for (
        const detection of
        preparedDetections
    ) {

        const person =
            findBestActivePerson(

                detection,

                detection.signature,

                usedPersonIds
            );


        if (person) {

            updatePerson(

                person,

                detection,

                detection.signature
            );


            usedPersonIds.add(
                person.id
            );


            result.push({
                ...person
            });


            removeNearbyPending(
                detection
            );
        }
    }


    // -----------------------------------------------------
    // MATCH RETURNING PEOPLE
    // -----------------------------------------------------

    for (
        const detection of
        preparedDetections
    ) {

        const alreadyUsed =
            result.some(

                person =>
                    usedPersonIds.has(
                        person.id
                    ) &&
                    distance(

                        person.cameraX,
                        person.cameraY,

                        detection.cameraX,
                        detection.cameraY
                    ) < 50
            );


        if (alreadyUsed) {
            continue;
        }


        const person =
            findRememberedPerson(

                detection,

                detection.signature,

                usedPersonIds
            );


        if (person) {

            updatePerson(

                person,

                detection,

                detection.signature
            );


            usedPersonIds.add(
                person.id
            );


            result.push({
                ...person
            });


            removeNearbyPending(
                detection
            );
        }
    }


    // -----------------------------------------------------
    // NEW PERSONS
    // -----------------------------------------------------

    for (
        const detection of
        preparedDetections
    ) {

        const alreadyUsed =
            result.some(
                person => {

                    return distance(

                        person.cameraX,
                        person.cameraY,

                        detection.cameraX,
                        detection.cameraY
                    ) < 50;
                }
            );


        if (alreadyUsed) {
            continue;
        }


        const pending =
            findPendingDetection(

                detection,

                detection.signature
            );


        if (pending) {

            pending.stableFrames++;


            pending.cameraX =
                detection.cameraX;

            pending.cameraY =
                detection.cameraY;

            pending.boxX =
                detection.boxX;

            pending.boxY =
                detection.boxY;

            pending.width =
                detection.width;

            pending.height =
                detection.height;

            pending.signature =
                detection.signature;


            if (
                pending.stableFrames >=
                REQUIRED_STABLE_FRAMES
            ) {

                const newPerson =
                    createPerson(

                        detection,

                        detection.signature
                    );


                trackedPeople.push(
                    newPerson
                );


                usedPersonIds.add(
                    newPerson.id
                );


                result.push({
                    ...newPerson
                });


                recordEntry(
                    newPerson
                );


                pendingDetections =
                    pendingDetections.filter(

                        item =>
                            item !==
                            pending
                    );
            }

        } else {

            pendingDetections.push({

                cameraX:
                    detection.cameraX,

                cameraY:
                    detection.cameraY,

                boxX:
                    detection.boxX,

                boxY:
                    detection.boxY,

                width:
                    detection.width,

                height:
                    detection.height,

                signature:
                    detection.signature,

                stableFrames:
                    1,

                age:
                    0
            });
        }
    }


    // -----------------------------------------------------
    // AGE ACTIVE TRACKS
    // -----------------------------------------------------

    for (
        const person of
        trackedPeople
    ) {

        if (
            !usedPersonIds.has(
                person.id
            )
        ) {

            person.missingFrames++;


            if (
                person.missingFrames ===
                MAX_MISSING_FRAMES
            ) {

                recordExit(
                    person
                );
            }
        }
    }


    // -----------------------------------------------------
    // CLEAN PENDING DETECTIONS
    // -----------------------------------------------------

    for (
        const pending of
        pendingDetections
    ) {

        pending.age++;
    }


    pendingDetections =
        pendingDetections.filter(

            pending =>
                pending.age < 8
        );


    return result;
}


// =========================================================
// FIXED ROOM OBJECTS
// =========================================================

const fixedObjects = [

    {
        name:
            "TABLE",

        x:
            14,

        y:
            3,

        width:
            4,

        height:
            3
    },

    {
        name:
            "DESK",

        x:
            4,

        y:
            11,

        width:
            5,

        height:
            3
    }

];


// =========================================================
// CAMERA -> GRID
// =========================================================

function cameraToGrid(
    cameraX,
    cameraY
) {

    const gridX =
        Math.floor(

            (
                cameraX /
                CAMERA_WIDTH
            ) *
            GRID_COLS
        );


    const gridY =
        Math.floor(

            (
                cameraY /
                CAMERA_HEIGHT
            ) *
            GRID_ROWS
        );


    return {

        x:
            clamp(
                gridX,
                0,
                GRID_COLS - 1
            ),

        y:
            clamp(
                gridY,
                0,
                GRID_ROWS - 1
            )
    };
}


// =========================================================
// VISITED CELLS
// =========================================================

function updateVisitedCells(
    people
) {

    for (
        const person of
        people
    ) {

        const gridPosition =
            cameraToGrid(

                person.cameraX,

                person.cameraY
            );


        const cellKey =
            `${gridPosition.x},${gridPosition.y}`;


        visitedCells.add(
            cellKey
        );
    }
}


// =========================================================
// STEP 41: MOVEMENT PATH
// =========================================================

function updateMovementPath(
    people
) {

    for (
        const person of
        people
    ) {

        let personPath =
            movementPaths.get(
                person.id
            );


        if (!personPath) {

            personPath = {

                path: [],

                lastCameraX:
                    null,

                lastCameraY:
                    null
            };


            movementPaths.set(
                person.id,
                personPath
            );
        }


        if (
            personPath.lastCameraX === null ||
            personPath.lastCameraY === null
        ) {

            personPath.lastCameraX =
                person.cameraX;

            personPath.lastCameraY =
                person.cameraY;


            personPath.path.push({

                x:
                    person.cameraX,

                y:
                    person.cameraY
            });


            continue;
        }


        const movementDistance =
            distance(

                person.cameraX,
                person.cameraY,

                personPath.lastCameraX,
                personPath.lastCameraY
            );


        if (
            movementDistance >=
            MIN_PATH_DISTANCE
        ) {

            personPath.path.push({

                x:
                    person.cameraX,

                y:
                    person.cameraY
            });


            personPath.lastCameraX =
                person.cameraX;

            personPath.lastCameraY =
                person.cameraY;
        }
    }
}


// =========================================================
// OBJECT OVERLAP
// =========================================================

function checkObjectOverlap(
    person
) {

    const gridPosition =
        cameraToGrid(

            person.cameraX,

            person.cameraY
        );


    for (
        const object of
        fixedObjects
    ) {

        const insideObject =

            gridPosition.x >=
                object.x &&

            gridPosition.x <
                object.x +
                object.width &&

            gridPosition.y >=
                object.y &&

            gridPosition.y <
                object.y +
                object.height;


        if (insideObject) {

            return object.name;
        }
    }


    return null;
}


// =========================================================
// DRAW GRID
// =========================================================

function drawGrid(
    people
) {

    gridCtx.clearRect(

        0,
        0,

        gridCanvas.width,
        gridCanvas.height
    );


    // GRID

    for (
        let y = 0;
        y < GRID_ROWS;
        y++
    ) {

        for (
            let x = 0;
            x < GRID_COLS;
            x++
        ) {

            gridCtx.strokeStyle =
                "#cccccc";


            gridCtx.strokeRect(

                x * CELL_SIZE,

                y * CELL_SIZE,

                CELL_SIZE,
                CELL_SIZE
            );
        }
    }


    // VISITED CELLS

    for (
        const cellKey of
        visitedCells
    ) {

        const parts =
            cellKey.split(",");


        const x =
            Number(parts[0]);


        const y =
            Number(parts[1]);


        gridCtx.fillStyle =
            "#ffcccc";


        gridCtx.fillRect(

            x * CELL_SIZE,

            y * CELL_SIZE,

            CELL_SIZE,
            CELL_SIZE
        );
    }


    // MOVEMENT PATHS

    for (
        const [
            personId,
            personPath
        ]
        of movementPaths
    ) {

        if (
            personPath.path.length <= 1
        ) {

            continue;
        }


        gridCtx.beginPath();


        for (
            let i = 0;
            i < personPath.path.length;
            i++
        ) {

            const point =
                personPath.path[i];


            const gridX =
                (
                    point.x /
                    CAMERA_WIDTH
                ) *
                gridCanvas.width;


            const gridY =
                (
                    point.y /
                    CAMERA_HEIGHT
                ) *
                gridCanvas.height;


            if (i === 0) {

                gridCtx.moveTo(
                    gridX,
                    gridY
                );

            } else {

                gridCtx.lineTo(
                    gridX,
                    gridY
                );
            }
        }


        const colorIndex =
            (
                personId - 1
            ) %
            pathColors.length;


        gridCtx.strokeStyle =
            pathColors[colorIndex];


        gridCtx.lineWidth =
            3;


        gridCtx.lineJoin =
            "round";


        gridCtx.lineCap =
            "round";


        gridCtx.stroke();


        gridCtx.lineWidth =
            1;
    }


    // FIXED OBJECTS

    for (
        const object of
        fixedObjects
    ) {

        gridCtx.fillStyle =
            "#999999";


        gridCtx.fillRect(

            object.x *
                CELL_SIZE,

            object.y *
                CELL_SIZE,

            object.width *
                CELL_SIZE,

            object.height *
                CELL_SIZE
        );


        gridCtx.fillStyle =
            "#000000";


        gridCtx.font =
            "bold 12px Arial";


        gridCtx.fillText(

            object.name,

            object.x *
                CELL_SIZE +
                5,

            object.y *
                CELL_SIZE +
                18
        );
    }


    // CURRENT PEOPLE

    for (
        const person of
        people
    ) {

        const gridPosition =
            cameraToGrid(

                person.cameraX,

                person.cameraY
            );


        const objectName =
            checkObjectOverlap(
                person
            );


        let locationStatus =
            "FREE";


        if (objectName) {

            locationStatus =
                objectName;


            console.log(

                `PERSON ${person.id} is inside ${objectName}`
            );

        } else {

            console.log(

                `PERSON ${person.id} is in free space`
            );
        }


        const gx =
            gridPosition.x *
            CELL_SIZE;


        const gy =
            gridPosition.y *
            CELL_SIZE;


        gridCtx.fillStyle =
            "#ffcccc";


        gridCtx.fillRect(

            gx,
            gy,

            CELL_SIZE,
            CELL_SIZE
        );


        gridCtx.fillStyle =
            "#000000";


        gridCtx.font =
            "bold 9px Arial";


        gridCtx.fillText(

            `P${person.id}`,

            gx + 2,
            gy + 10
        );


        gridCtx.font =
            "bold 8px Arial";


        gridCtx.fillText(

            locationStatus,

            gx + 2,
            gy + 20
        );
    }


    // BORDER

    gridCtx.strokeStyle =
        "#000000";


    gridCtx.lineWidth =
        2;


    gridCtx.strokeRect(

        0,
        0,

        gridCanvas.width,
        gridCanvas.height
    );


    gridCtx.lineWidth =
        1;
}


// =========================================================
// DRAW CAMERA DETECTIONS
// =========================================================

function drawDetections(
    people
) {

    detectionCtx.clearRect(

        0,
        0,

        detectionCanvas.width,
        detectionCanvas.height
    );


    for (
        const person of
        people
    ) {

        detectionCtx.strokeStyle =
            "#00ff00";


        detectionCtx.lineWidth =
            3;


        detectionCtx.strokeRect(

            person.boxX,
            person.boxY,

            person.width,
            person.height
        );


        detectionCtx.fillStyle =
            "#00ff00";


        detectionCtx.font =
            "bold 18px Arial";


        detectionCtx.fillText(

            `PERSON ${person.id}`,

            person.boxX,

            Math.max(

                20,

                person.boxY - 8
            )
        );


        detectionCtx.beginPath();


        detectionCtx.arc(

            person.cameraX,
            person.cameraY,

            5,

            0,
            Math.PI * 2
        );


        detectionCtx.fill();
    }
}


// =========================================================
// STEP 43: UPDATED VISIBLE STATUS
// =========================================================

function updateStatus(
    people
) {

    const currentPeople =
        people.length;


    if (
        currentPeople >
        maximumPeople
    ) {

        maximumPeople =
            currentPeople;
    }


    if (detectionStatus) {

        detectionStatus.textContent =
            `CURRENT PEOPLE : ${currentPeople} | ` +
            `MAX PEOPLE : ${maximumPeople}`;
    }


    if (occupancyStatus) {

        occupancyStatus.textContent =
            `TOTAL ENTRIES : ${totalEntries} | ` +
            `TOTAL EXITS : ${totalExits} | ` +
            `ROOM OCCUPANCY : ${currentPeople}`;
    }


    if (cameraMessage) {

        if (
            people.length === 0
        ) {

            cameraMessage.textContent =
                lastEntryExitMessage;

        } else {

            cameraMessage.textContent =
                `${lastEntryExitMessage} | Inside: ${currentPeople}`;
        }
    }
}


// =========================================================
// STEP 43: CONSOLE STATISTICS
// =========================================================

function logStatistics(
    people
) {

    console.log(
        "===== STEP 43 STATISTICS ====="
    );

    console.log(
        `CURRENT PEOPLE: ${people.length}`
    );

    console.log(
        `MAX PEOPLE: ${maximumPeople}`
    );

    console.log(
        `TOTAL ENTRIES: ${totalEntries}`
    );

    console.log(
        `TOTAL EXITS: ${totalExits}`
    );

    console.log(
        `ROOM OCCUPANCY: ${people.length}`
    );

    console.log(
        "=============================="
    );
}


// =========================================================
// MEDIAPIPE INITIALIZATION
// =========================================================

async function initializeDetector() {

    try {

        if (cameraMessage) {

            cameraMessage.textContent =
                "Loading AI detector...";
        }


        const vision =
            await FilesetResolver.forVisionTasks(

                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm"
            );


        objectDetector =
            await ObjectDetector.createFromOptions(

                vision,

                {

                    baseOptions: {

                        modelAssetPath:

                            "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite"
                    },


                    runningMode:
                        "VIDEO",


                    scoreThreshold:
                        SCORE_THRESHOLD,


                    maxResults:
                        10
                }
            );


        if (cameraMessage) {

            cameraMessage.textContent =
                "AI detector ready";
        }


        console.log(
            "MediaPipe detector initialized"
        );


    } catch (error) {

        console.error(

            "Detector initialization error:",

            error
        );


        if (cameraMessage) {

            cameraMessage.textContent =
                "Failed to load AI detector";
        }
    }
}


// =========================================================
// LOAD CAMERAS
// =========================================================

async function loadCameras() {

    try {

        const devices =
            await navigator.mediaDevices
                .enumerateDevices();


        const cameras =
            devices.filter(

                device =>
                    device.kind ===
                    "videoinput"
            );


        if (!cameraSelect) {
            return;
        }


        cameraSelect.innerHTML =
            "";


        if (
            cameras.length === 0
        ) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                "";


            option.textContent =
                "No camera found";


            cameraSelect.appendChild(
                option
            );


            return;
        }


        cameras.forEach(

            (
                camera,
                index
            ) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    camera.deviceId;


                option.textContent =
                    camera.label ||
                    `Camera ${index + 1}`;


                cameraSelect.appendChild(
                    option
                );
            }
        );


        const camoCamera =
            cameras.find(

                camera =>
                    camera.label
                        ?.toLowerCase()
                        .includes(
                            "camo"
                        )
            );


        if (camoCamera) {

            cameraSelect.value =
                camoCamera.deviceId;
        }


    } catch (error) {

        console.error(

            "Camera loading error:",

            error
        );
    }
}


// =========================================================
// START CAMERA
// =========================================================

async function startCamera() {

    try {

        if (cameraMessage) {

            cameraMessage.textContent =
                "Requesting camera...";
        }


        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(

                    track =>
                        track.stop()
                );


            cameraStream =
                null;
        }


        const deviceId =
            cameraSelect?.value;


        let constraints = {

            video: {

                width: {

                    ideal:
                        CAMERA_WIDTH
                },

                height: {

                    ideal:
                        CAMERA_HEIGHT
                },

                deviceId:

                    deviceId
                        ? {
                            exact:
                                deviceId
                        }
                        : undefined
            },

            audio:
                false
        };


        try {

            cameraStream =
                await navigator
                    .mediaDevices
                    .getUserMedia(
                        constraints
                    );

        } catch (error) {

            console.warn(

                "Selected camera failed. Trying default camera...",

                error
            );


            constraints = {

                video: {

                    width: {

                        ideal:
                            CAMERA_WIDTH
                    },

                    height: {

                        ideal:
                            CAMERA_HEIGHT
                    }
                },

                audio:
                    false
            };


            cameraStream =
                await navigator
                    .mediaDevices
                    .getUserMedia(
                        constraints
                    );
        }


        cameraVideo.srcObject =
            cameraStream;


        await cameraVideo.play();


        await loadCameras();


        trackedPeople =
            [];

        pendingDetections =
            [];


        visitedCells.clear();


        movementPaths.clear();


        entryExitEvents =
            [];


        lastEntryExitMessage =
            "Waiting for people...";


        // STEP 43 RESET

        totalEntries =
            0;

        totalExits =
            0;

        maximumPeople =
            0;


        // STEP 44 RESET

        occupancyHistory =
            [];

        lastRecordedOccupancy =
            null;


        createStatisticsPanel();


        // STEP 45
        // Create webpage history panel.

        createOccupancyHistoryPanel();


        updateStatistics([]);


        // STEP 45
        // Make sure the webpage history
        // starts empty after camera restart.

        updateOccupancyHistoryPanel();


        if (cameraMessage) {

            cameraMessage.textContent =
                "Camera running";
        }


        console.log(
            "Camera started"
        );


        requestAnimationFrame(
            detectFrame
        );


    } catch (error) {

        console.error(

            "Camera error:",

            error
        );


        if (cameraMessage) {

            cameraMessage.textContent =
                "Unable to start camera: " +
                error.name;
        }
    }
}


// =========================================================
// DETECTION LOOP
// =========================================================

async function detectFrame() {

    if (
        !objectDetector ||
        cameraVideo.readyState < 2
    ) {

        requestAnimationFrame(
            detectFrame
        );

        return;
    }


    if (
        cameraVideo.currentTime !==
        lastVideoTime
    ) {

        lastVideoTime =
            cameraVideo.currentTime;


        try {

            const result =
                objectDetector.detectForVideo(

                    cameraVideo,

                    performance.now()
                );


            const detections =
                processDetections(
                    result
                );


            const people =
                updatePersonTracking(
                    detections
                );


            updateVisitedCells(
                people
            );


            updateMovementPath(
                people
            );


            drawDetections(
                people
            );


            drawGrid(
                people
            );


            // STEP 43

            updateStatistics(
                people
            );


            // STEP 43

            updateStatus(
                people
            );


            // STEP 43

            logStatistics(
                people
            );


            // STEP 44
            // Record occupancy only when
            // the number of people changes.

            updateOccupancyHistory(
                people
            );


            console.log(

                "Active:",

                people.map(

                    p =>
                        `PERSON ${p.id}`
                ).join(", ")
            );


        } catch (error) {

            console.error(

                "Detection error:",

                error
            );
        }
    }


    requestAnimationFrame(
        detectFrame
    );
}


// =========================================================
// BUTTON
// =========================================================

if (startCameraButton) {

    startCameraButton.addEventListener(

        "click",

        startCamera
    );
}


// =========================================================
// CAMERA CHANGE
// =========================================================

if (cameraSelect) {

    cameraSelect.addEventListener(

        "change",

        async () => {

            await startCamera();
        }
    );
}


// =========================================================
// INITIALIZE
// =========================================================

async function initialize() {

    await loadCameras();

    await initializeDetector();

    createStatisticsPanel();

    createOccupancyHistoryPanel();

    updateStatistics([]);

    updateOccupancyHistoryPanel();
}


initialize();
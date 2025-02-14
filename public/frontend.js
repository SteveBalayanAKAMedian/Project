let myMap;
let objectManager;
let allRequiredMarksMap = new Map(); //объекты внутри objectManager'a
let idOfMarks = 0; //считаем айдишники всех меток для корректной работы
let allRequiredDistrictsMap = new Map();
let updateMap = false;
let updateRegion = '';
let updateYear = [true, false, false]; //0 -- это 2016, 1 -- это 2017, 2 -- это 2018 нужна для построения точек
let areMarksShown = false; //Нужна, чтобы не загружать каждый раз точки заново
let globalZoom = false; //false если не входит

document.addEventListener('DOMContentLoaded', init);

//инициализация всего
function init() {
    ymaps.ready(initMap);

    //кнопки выбора года
    let searchByYear2016 = document.getElementById("btnSearchByYear2016");
    searchByYear2016.addEventListener('click', () => {
        updateYear[0] = !updateYear[0];
        if(!updateYear[0]) {
            searchByYear2016.classList.remove('btn-warning');
            searchByYear2016.classList.add('btn-primary');
        } else {
            searchByYear2016.classList.add('btn-warning');
            searchByYear2016.classList.remove('btn-primary');
        }
        if(updateYear[0] && globalZoom) {
            querySearchByRegion(2016);
        } 
        if(!updateYear[0]) {
            removeSearchByRegion(2016);
        }
    });
    let searchByYear2017 = document.getElementById("btnSearchByYear2017");
    searchByYear2017.addEventListener('click', () => {
        updateYear[1] = !updateYear[1];
        if(updateYear[1]) {
            searchByYear2017.classList.add('btn-warning');
            searchByYear2017.classList.remove('btn-primary');
        }
        else {
            searchByYear2017.classList.remove('btn-warning');
            searchByYear2017.classList.add('btn-primary');
        }
        if(updateYear[1] && globalZoom) {
            querySearchByRegion(2017);
        }
        if(!updateYear[1]) {
            removeSearchByRegion(2017);
        }
    });
    let searchByYear2018 = document.getElementById("btnSearchByYear2018");
    searchByYear2018.addEventListener('click', () => {
        updateYear[2] = !updateYear[2];
        if(updateYear[2]) {
            searchByYear2018.classList.add('btn-warning');
            searchByYear2018.classList.remove('btn-primary');
        }
        else {
            searchByYear2018.classList.remove('btn-warning');
            searchByYear2018.classList.add('btn-primary');
        }
        if(updateYear[2] && globalZoom) {
            querySearchByRegion(2018);
        }
        if(!updateYear[2]) {
            removeSearchByRegion(2018);
        }
    });
    let numberOfAccidentsTextBox = false;
    let firstNumberOfAccidents = document.getElementById('firstNumberOfAccidents');
    firstNumberOfAccidents.value = "Искать среди первых N ДТП";
    firstNumberOfAccidents.addEventListener('click', () => {
        if(!numberOfAccidentsTextBox) {
            numberOfAccidentsTextBox = true;
            firstNumberOfAccidents.value = "";
        }
    });
    let btnSendNumberOfAccidents = document.getElementById('btnSendNumberOfAccidents');
    btnSendNumberOfAccidents.addEventListener('click', postSendNumberOfAccidents);
}

//инициализация самой карты
function initMap() {
    myMap = new ymaps.Map(
        'map',
        {
            center: [57.682891, 34.096125],
            zoom: 6
        },
        {
            searchControlProvider: 'yandex#search'
        }
    );
    
    //тут очень сильно шакалят кластеры, я вообще не понимаю, что это -- TODO: fix
    objectManager = new ymaps.ObjectManager({
        // Чтобы метки начали кластеризоваться, выставляем опцию.
        clusterize: true,
        // ObjectManager принимает те же опции, что и кластеризатор.
        gridSize: 32,
        clusterDisableClickZoom: true
    });
    myMap.geoObjects.add(objectManager);
    objectManager.objects.options.set('preset', 'islands#greenDotIcon');
    objectManager.clusters.options.set('preset', 'islands#orangeClusterIcons');
    
    //Вывод районов Санкт-Петербурга и Москвы
    for(let cityName = 0; cityName < 2; cityName++) { 
        axios.get('/districts_coordinates', { params: { city: cityName } }).then(function(response) {
            for(let i = 0; i < response.data.length; i++) {
                for(let j = 0; j < response.data[i].coordinates.length; j++) {
                    let item = new ymaps.Polygon(
                        response.data[i].coordinates[j], {
                            balloonContentHeader: response.data[i].name,
                            balloonContentBody: 'Количество ДТП 2016 ' + response.data[i].accidents[0].length + '<br>' + 'Количество ДТП 2017 ' + response.data[i].accidents[1].length + '<br>' + 'Количество ДТП 2018 ' + response.data[i].accidents[2].length + '<br>' + 'Всего ' + Number(response.data[i].accidents[0].length + response.data[i].accidents[1].length + response.data[i].accidents[2].length)
                        }, { 
                            fillOpacity: 0.5, strokeWidth: 1 
                        });
                    myMap.geoObjects.add(item);
                }
            
            }
        });
    }
    
    //определяет смену области видимости и зум, чтобы ставить метки
    myMap.events.add('boundschange', function (event) {
            console.log(event.get('newZoom'));
            if(event.get('newZoom') == event.get('oldZoom')) {
                return;
            }
            if(event.get('newZoom') >= 13 && !areMarksShown) { //От цифры в этой строке зависит с какого момента будут появляться метки
                areMarksShown = true;
                globalZoom = true;
                for(let i = 0; i < 3; i++) {
                    if(updateYear[i]) {
                        querySearchByRegion(2016 + Number(i));
                    }
                }
            }
            if(event.get('newZoom') < 13) {
                areMarksShown = false;
                globalZoom = false;
                removeAllSearchByRegion();
            }
    });
}

//запрос на сервер по году, так как региона пока что два для вызова меток
async function querySearchByRegion(searchYear) {
    let region = ["Москва", "Санкт-Петербург"];
    for(let i = 0; i < 2; i++) {
        if(allRequiredMarksMap.has(region[i] + searchYear)) continue;
        await axios.get('/car_accident_in_region', { params: { regionName: region[i], year: searchYear, n: 0 } }).then(async function (response) {
                let carAccidents = response.data;
                let tmp = [];
                for (let i = 0; i < carAccidents.length; i++) {
                    let pointColor = 'green';
                    if (searchYear == 2017) {
                        pointColor = 'blue'
                    } 
                    else if (searchYear == 2018) {
                        pointColor = 'red'
                    }
                    let pointIcon = 'Auto';
                    if (carAccidents[i].fatalities > 0) {
                        pointIcon = 'Attention';
                    }
                    let presetPoint = 'islands#' + pointColor + pointIcon + 'CircleIcon';
                    let item =  {
                        type: 'Feature',
                        id: idOfMarks,
                        geometry: {
                            type: 'Point',
                            coordinates: carAccidents[i].coordinates
                        },
                        properties: {
                            balloonContentHeader:
                                'Данные аварии',
                            balloonContentBody:
                                '<font size=3><b>Погибшие: </b></font>' + carAccidents[i].fatalities + '<br>' + '<font size=3><b>Пострадавшие: </b></font>' + carAccidents[i].victims + '<br>' + '<font size=3><b>Тип происшествия: </b></font>' + carAccidents[i].type,
                        },
                        options: {
                            preset: presetPoint
                        }
                    };
                    idOfMarks++;
                    tmp.push(item);
                }
                objectManager.add(tmp);
                allRequiredMarksMap.set(region[i] + searchYear, tmp);
        });
    }
}

//удаление всех меток, потому что маленький коэффицент масштаба
function removeAllSearchByRegion() {
    objectManager.removeAll();
    allRequiredMarksMap.clear(); //region и year -- это строки
}

//удаление меток за определённый год
function removeSearchByRegion(year) {
    let region = ["Москва", "Санкт-Петербург"];
    for(let i = 0; i < 2; i++) {
        if (allRequiredMarksMap.has(region[i] + year)) {
            objectManager.remove(allRequiredMarksMap.get(region[i] + year));
            allRequiredMarksMap.delete(region[i] + year); //region и year -- это строки
        }
    }
    
}

//меняет количество выводимых меток в зависимости от желания пользователя
function postSendNumberOfAccidents() {
    let num = Number(firstNumberOfAccidents.value);
    axios.get('/post_first_searches', { params: { firstN: num } }).then(async function (response) {
        if(globalZoom)
        {
            objectManager.removeAll(); //Очищает карту, чтобы перестроить всё заново
            allRequiredMarksMap.clear();
            for(let i = 0; i < 3; i++) {
                if(updateYear[i]) {
                    querySearchByRegion(2016 + Number(i));
                }
            }
        }
    });
}

//вытаскиваем с сервера информацию по районам и считаем количество ДТП в каждом
//функция отрабатывает один раз, потому что это precalc
//результаты работы сохраняем в файлы
//файлы гоним на сервер
//оттуда вытаскиваем при новых запросах пользователей
/*async function showCityWithStatDistricts() {
    let cityName = cityWithStatDistricts.value;
    //объявим это всё заранее, потому что потом передадим на сервер
    let districtsNames = [];
    let districtsCoordinates = [];
    let accidentsArray = [];
    for(let year = 2016; year <= 2018; ++year) {
    //написано не очень оптимально, потому что нам не нужно несколько раз выгружать и заново создавать районы,
    //но т.к. это отработает один раз, то можно забить и переписать сильно позже
        await axios.get('/car_accident_in_region', { params: { regionName: cityName, year: year, n: 1 } }).then(async function (response1) {
            let carAccidents = response1.data;
            await axios.get('/districts_coordinates', { params: { city: cityName } }).then(function (response2) {
                districtsNames = response2.data[0];
                districtsCoordinates = response2.data[1];
                let districtsArray = []; //уже собранные в структуры районы
                //по массиву с районами
                for (let i = 0; i < districtsCoordinates.length; i++) {
                    let tmp = [];
                    //по массивам подрайонов одного района (тип multipolygon)
                    for (let j = 0; j < districtsCoordinates[i].length; j++) {
                        //отдельно по каждой паре координат
                        for (let k = 0; k < districtsCoordinates[i][j][0].length; k++) { //нулевое -- из-за странной лишней обёртки
                            let a = Number(districtsCoordinates[i][j][0][k][0]); //какая-то идейность с координатами, почему-то в файлах от
                            let b = Number(districtsCoordinates[i][j][0][k][1]); //заказчика перепутаны широта с долготой
                            districtsCoordinates[i][j][0][k][1] = a;
                            districtsCoordinates[i][j][0][k][0] = b;
                        }
                        //взято из документации API карт, без этого нельзя будет пользоваться функцией проверки
                        //принадлежности точки многоугольнику
                        var item = new ymaps.Polygon([
                           districtsCoordinates[i][j][0]
                        ]);
                        item.geometry.setMap(myMap);
                        item.options.setParent(myMap.options);
                        tmp.push(item);
                    }
                    districtsArray.push(tmp);
                    tmp = [];
                }
                //console.log(districtsArray);
                //console.log(districtsNames);
                let myMapStruct = new Map();
                //key -- название района
                //value -- все ДТП в нём
                for(let i = 0; i < districtsArray.length; ++i) {
                    let tmp = [];
                    for(let j = 0; j < districtsArray[i].length; ++j) {
                        for(let k = 0; k < carAccidents.length; ++k) {
                            if(districtsArray[i][j].geometry.contains(carAccidents[k].coordinates)) {
                                tmp.push(carAccidents[k]);
                            }
                        }
                    }
                    myMapStruct.set(districtsNames[i], tmp);
                    tmp = [];
                }
                console.log(myMapStruct);
                let tmp = [];
                for(const [key, value] of myMapStruct.entries()) {
                    tmp.push(value);
                }
                accidentsArray.push(tmp);
            });
        });
    }
    console.log(accidentsArray);
    console.log('flex');
    axios.post('/districts_save_data', 
    { 
        accidentsArray: accidentsArray, 
        districtsCoordinates: districtsCoordinates, 
        districtsNames: districtsNames, 
        cityName: cityName 
    }).then(function (response) {
        console.log(response.data);

    });
}*/


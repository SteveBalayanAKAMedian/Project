let myMap;
let objectManager;
let result = []; //объекты внутри objectManager'a
let allRequiredRegions = [];

document.addEventListener('DOMContentLoaded', init);

//инициализация всего
//TODO -- 100500 кнопок переписать на нормальные менюшки
function init() {
    //проверка работы сервера
    let testServer = document.getElementById('testServer');
    testServer.addEventListener('click', () => {
        axios.get('/hello').then(function (response) {
            console.log(response);
            console.log('Server is on!');
        });
    });


    ymaps.ready(initMap);
    //поисковая строка отображения ДТП по регионам
    let searchByRegion = document.getElementById('searchByRegion');
    //дополнительное поле под год -- TODO: сделать выползающей менюшкой
    let searchByYear = document.getElementById('searchByYear');
    //кнопка отправки запроса поисковой строки выше
    let btnSendSearchByRegion = document.getElementById('btnSendSearchByRegion');
    //кнопка очистки карты, полной очистки от меток
    let btnClearMap = document.getElementById('btnClearMap');
    //есть шакальство с кластеризацией, TODO -- fix it
    btnClearMap.addEventListener('click', clearWholeMap);
    
    //тут для красоты
    searchByRegion.value= "Название региона";
    searchByYear.value= "Год поиска";
    searchByRegion.addEventListener('click', () => {
        searchByRegion.value = "";
    });
    searchByYear.addEventListener('click', () => {
        searchByYear.value = "";
    });

    //запрашиваем у сервера данные для отображения
    btnSendSearchByRegion.addEventListener('click', querySearchByRegion);
}

//инициализация самой карты
function initMap() {
    myMap = new ymaps.Map(
        'map',
        {
            center: [55.76, 37.64],
            zoom: 5
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
    objectManager.clusters.options.set('preset', 'islands#greenClusterIcons');
}

//запрос на сервер по региону и году
function querySearchByRegion() {
    let region = searchByRegion.value;
    let year = searchByYear.value;
    //searchByRegion.value = "";
    //searchByYear.value = "";
    axios.get('/car_accident_in_region', { params: { regionName: region, year: year } }).then(function (response) {
        console.log(response);
        console.log(response.data.length);
        if (response.data.length === 0 || allRequiredRegions.find((element, index, array) => {
            return (array[index][0] === region && array[index][1] === year);
        })) {
            alert('Error, send ur request');
        }
        else {
            allRequiredRegions.push([region, year]);
            showAccidents(response.data, year);
        }
        console.log(allRequiredRegions);
    });
}

//отображение меток, TODO -- задавать цвет в зависимости от года
function showAccidents(carAccidents, year) {
    objectManager.removeAll();

    console.log(result);

    for (let i = 0; i < carAccidents.length; i++) {
        let item =  {
            type: 'Feature',
            //id: 1,
            geometry: {
                type: 'Point',
                coordinates: carAccidents[i]
            } 
        };
        result.push(item);
    }
    console.log(result);
    objectManager.add(result);
}

function clearWholeMap() {
    result.splice(0);
    allRequiredRegions.splice(0);
    console.log(result);
    console.log(allRequiredRegions);
    objectManager.removeAll();
    objectManager.add(result);
}
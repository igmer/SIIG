function ifLoading($http) {
      return {
        restrict: 'A',
        link: function(scope, elem) {
            scope.isLoading = isLoading;

            scope.$watch(scope.isLoading, toggleElement);

            function toggleElement(loading) {
              (loading) ? elem.show() : elem.hide();           
            }

            function isLoading() {
              return $http.pendingRequests.length > 0;
            }
        }
      };
    }

    ifLoading.$inject = ['$http'];    
function hexToRGBA(hex, opacity) {
    return 'rgba(' + (hex = hex.replace('#', '')).match(new RegExp('(.{' + hex.length/3 + '})', 'g')).map(function(l) { return parseInt(hex.length%2 ? l+l : l, 16) }).concat(opacity||1).join(',') + ')';
}    
var tableroCalidadApp = angular.module('tableroCalidadApp', ['serviciosGeneral', 'ui.bootstrap', 'chart.js'])
        .config(['$interpolateProvider', function ($interpolateProvider) {
                $interpolateProvider.startSymbol('[[');
                $interpolateProvider.endSymbol(']]');
            }])
        .directive('ifLoading', ifLoading)
        .controller('mainCtrl', function AppCtrl($scope, Indicadores, DetalleIndicador, EvaluacionesComplementarias) {
            $scope.options = {width: 300, height: 250, 'bar': 'aaa'};
            $scope.data = [0];
            $scope.deptoSeleccionado = 'todos';
            $scope.hovered = function (d) {
                $scope.barValue = d;
                $scope.$apply();
            };
            $scope.filtroIndicador = '';
            $scope.filtroListadoIndicador = '';

            $scope.titulo = 'Monitoreo y Evaluación de la Gestión de la Calidad en RIISS';
            $scope.subtitulo = 'Unidad Nacional Gestión de Calidad de la RIISS - VMSS';
            $scope.subtitulo2 = '';
            $scope.indicadorSeleccionado = [];
            $scope.datosGrafico2 = [];
            $scope.mostrarInfoIndicador = false;
            $scope.options_bar_line = {
                scales: {                                     
                    yAxes: [{ ticks: { min: 0, max: 100} }]
                }
            };
            $scope.options_bar_time = {
                scales: {                                     
                    yAxes: [{ ticks: { min: 0, max: 100}, scaleLabel: {labelString : 'minutos', display:true} }]
                }
            };
                        
            $scope.formatTime = function(x) {
                var hh = ~~(parseFloat(x) / 60); 
                var mm = parseInt(parseFloat(x) % 60);
                if (mm < 0) mm = mm * -1;
                return hh + ':' +  ('0'+mm).slice(-2);
            };
            
            $scope.procesar = function () {
                $scope.indicadores = [];
                $scope.indicadores2 = [];
                $scope.evaluaciones_complementarias = [];
                var nivel = $scope.filtroIndicador;
                if (nivel === '') {
                    $('#filtroIndicadorGrp').notify('Seleccione el nivel', {className: "error" });
                    return;
                }
                
                $scope.subtitulo2 = 'Tablero de Mando :: Periodo ' + $('#selectPeriodo option:selected').text();
                
                $scope.mostrarInfoIndicador = false;
                Indicadores.query({ periodo: $scope.periodoSeleccionado, tipo:1, nivel:nivel, departamento: $scope.deptoSeleccionado })
                    .$promise.then(
                            function (data) {
                                $scope.indicadores = (data != '') ? data[0].datos : [];
                                $scope.indicadoresTop10 = (data != '') ? data[0].top10 : [];
                                $scope.indicadoresLess10 = (data != '') ? data[0].less10 : [];
                                $scope.filtroListadoIndicador = 'todos';
                                
                                $scope.datosGrafico1 = $scope.indicadores;
                                
                                $scope.labelsGrp1 = [];
                                $scope.valorGrp1 = [];
                                $scope.coloresGrp1 = [];
                                $scope.datosGrafico1.forEach(function(nodo, index){
                                    $scope.labelsGrp1.push(nodo.codigo_indicador);
                                    $scope.valorGrp1.push(nodo.calificacion);
                                    $scope.coloresGrp1.push(nodo.color);
                                });
                            },
                            function (error) {
                                alert(error);
                            }
                    );
            
                 Indicadores.query({ periodo: $scope.periodoSeleccionado, tipo:2, nivel:nivel, departamento: $scope.deptoSeleccionado })
                    .$promise.then(
                            function (data) {
                                $scope.indicadores2 = (data != '') ? data : [];
                            },
                            function (error) {
                                alert(error);
                            }
                    );
                EvaluacionesComplementarias.query({ nivel:nivel, departamento: $scope.deptoSeleccionado })
                .$promise.then(
                        function (data) {
                            $scope.evaluaciones_complementarias = (data != '') ? data[0] : [];
                            var utils = $.pivotUtilities;
                            var render =  utils.renderers["Table"];
                            var function_ =  utils.aggregators["Average"];

                            $("#pivotEvaluacionesComplementarias").pivot(
                              data[0].establecimiento, {
                                rows: ["nombre_corto"],
                                cols: ["tipo_evaluacion"],
                                aggregator: function_(["valor"]),
                                renderer: render
                              });
                            
                        },
                        function (error) {
                            alert(error);
                        }
                );
            
            };
            
            $scope.detalleArea = function(indicador){
                $scope.detalleIndicador = indicador;

                DetalleIndicador.query({ periodo: $scope.periodoSeleccionado, id: indicador.id, nivel: $scope.filtroIndicador, departamento: $scope.deptoSeleccionado })
                    .$promise.then(
                            function (data) {
                                $scope.detalle = (data != '') ? data[0] : [];
                                $scope.tablaDetalle();
                                $('#modalDetalleIndicador').modal('show');
                            },
                            function (error) {
                                alert(error);
                            }
                    );
            };
            
            $scope.tablaDetalle = function(){
                var promediofn = ($scope.detalleIndicador.unidad_medida === 'hh:mm') ? $.pivotUtilities.aggregatorTemplates.average($scope.formatTime) : $.pivotUtilities.aggregatorTemplates.average() ;
                $("#pivotDetalleIndicador").pivotUI($scope.detalle.actual, {
                    unusedAttrsVertical: false,
                    rows: ["establecimiento"],
                    cols: ["area"],
                    vals: ["calificacion"],
                    aggregatorName: "Average",
                    rendererName: "Tabla",
                    renderers: {
                        "Tabla": $.pivotUtilities.renderers['Table'],
                        "Tabla y columnas": $.pivotUtilities.renderers['Table Barchart'],
                        "Gráfico de líneas": $.pivotUtilities.c3_renderers['Line Chart'],
                        "Gráfico de columnas": $.pivotUtilities.c3_renderers['Bar Chart']
                    },
                    aggregators: {
                        "Average": promediofn,
                    },
                    onRefresh: $scope.arreglarValores0
                }, true);
                
                $scope.periodoDetalle = $('#selectPeriodo option:selected').text();
                
            };
            
            $scope.tablaHistorial = function(){
                var promediofn = ($scope.detalleIndicador.unidad_medida === 'hh:mm') ? $.pivotUtilities.aggregatorTemplates.average($scope.formatTime) : $.pivotUtilities.aggregatorTemplates.average() ;
                $("#pivotDetalleIndicador").pivotUI($scope.detalle.historico, {
                    renderers: {
                        "Tabla": $.pivotUtilities.renderers['Table'],
                        "Tabla y columnas": $.pivotUtilities.renderers['Table Barchart'],
                        "Gráfico de líneas": $.pivotUtilities.c3_renderers['Line Chart'],
                        "Gráfico de columnas": $.pivotUtilities.c3_renderers['Bar Chart']
                    },
                    aggregators: {
                        "Average": promediofn,
                    },
                    unusedAttrsVertical: false,
                    rows: ["establecimiento"],
                    cols: ["periodo"],
                    vals: ["calificacion"],
                    aggregatorName: "Average",
                    rendererName: "Tabla",
                    onRefresh: $scope.arreglarValores0
                }, true);
                
                $scope.periodoDetalle = 'Historial por establecimiento';
                $scope.arreglarValores0();
            };
            
            $scope.arreglarValores0 = function(){
                $('#pivotDetalleIndicador .pvtVal[data-value="0"]').html('0.00');
                $('#pivotDetalleIndicador .pvtTotal[data-value="0"]').html('0.00');
                $('#pivotDetalleIndicador .pvtTotalLabel').html('Totales');
            };
            
            $scope.cambiarGrafico1 = function(filtro){
                if (filtro === 'todos'){
                    $scope.datosGrafico1 = $scope.indicadores;
                }else if (filtro === '+10'){
                    $scope.datosGrafico1 = $scope.indicadoresTop10;
                }else if (filtro === '-10'){
                    $scope.datosGrafico1 = $scope.indicadoresLess10;
                }
                $scope.labelsGrp1 = [];
                $scope.valorGrp1 = [];
                $scope.coloresGrp1 = [];
                $scope.datosGrafico1.forEach(function(nodo, index){
                    $scope.labelsGrp1.push(nodo.codigo_indicador);
                    $scope.valorGrp1.push(nodo.calificacion);
                    $scope.coloresGrp1.push(nodo.color);
                });
                $scope.$apply();
            };
            $scope.seleccionarIndicador = function(indicadorSel){
                $scope.indicadorSeleccionado = indicadorSel;
                $scope.mostrarInfoIndicador = true;
                $scope.colors = ['#45b7cd', '#ff6384', '#ff8e72'];
               
                
                var labels = [];
                var valorEstandar = [];
                var valorEstablecimiento = [];
                var coloresGrp2 = [];
                
                indicadorSel.evaluacion.forEach(function(nodo, index){
                    labels.push(nodo.nombre_corto);
                    valorEstandar.push(indicadorSel.calificacion);
                    valorEstablecimiento.push(nodo.calificacion);
                    coloresGrp2.push(hexToRGBA(nodo.color,.3));
                });
                $scope.datasetOverride = [
                    {
                      label: "Calificación establecimiento",
                      borderWidth: 1,
                      type: 'bar',
                      backgroundColor: coloresGrp2
                    },
                    {
                      label: "Promedio nacional",
                      borderWidth: 3,
                      hoverBackgroundColor: "rgba(255,99,132,0.4)",
                      hoverBorderColor: "rgba(255,99,132,1)",
                      type: 'line',
                      fill:false,
                      borderColor: [indicadorSel.color]
                    }
                ];
                $scope.datosGrafico2 = [];
                $scope.labels = labels;
                //$scope.colors.push(coloresGrp2);                
                $scope.datosGrafico2.push(valorEstablecimiento);
                $scope.datosGrafico2.push(valorEstandar); 
                
                
            };
        });
var app = tableroCalidadApp;
<?php

namespace MINSAL\GridFormBundle\Entity;

use Doctrine\ORM\EntityRepository;
use Symfony\Component\HttpFoundation\Request;
use MINSAL\GridFormBundle\Entity\FormularioRepository;
use MINSAL\GridFormBundle\Entity\Formulario;

/**
 * IndicadorRepository
 * 
 */
class IndicadorRepository extends EntityRepository {

    public function getIndicadoresEvaluados($periodo) {
        $em = $this->getEntityManager();
        list($anio, $mes) = explode('_', $periodo);
        $datos = array();
        $calificaciones = array();
        
        //Recuperar los indicadores que no tienen asociado ningún criterio
        //Estos serán los que están cargados a todo el estándar
        $sql = "SELECT * FROM (SELECT B.posicion, A.codigo, A.descripcion, A.forma_evaluacion,  A.porcentaje_aceptacion, 'por_estandar' AS alcance_evaluacion,
                    B.descripcion descripcion_estandar, B.periodo_lectura_datos, B.id as estandar_id, B.codigo as codigo_estandar, A.id AS indicador_id,
                    (SELECT COUNT(codigo)
                        FROM variable_captura
                        WHERE formulario_id = B.id
                            AND es_separador = false
                            AND es_poblacion = false
                    ) AS total_criterios
                    FROM indicador A
                    INNER JOIN costos.formulario B ON (A.estandar_id = B.id)                    
                    WHERE A.id NOT IN (SELECT indicador_id FROM indicador_variablecaptura)
                        AND B.forma_evaluacion = 'lista_chequeo'
                    ) AS AA
                    WHERE total_criterios > 0
                    ORDER BY posicion, codigo_estandar, codigo
                    ";
        $indicadores = $em->getConnection()->executeQuery($sql)->fetchAll();
        
        foreach ($indicadores as $ind){
            $Frm = $em->getRepository('GridFormBundle:Formulario')->find($ind['estandar_id']);
            $eval_ = $this->getDatosEvaluacion($Frm, $periodo, $ind);
            
            $calificacion = 0;
            $eval = array();
            foreach($eval_ as $e){
                $calificacion += $e['calificacion'];
            }
            $calificacionIndicador = (count($eval_) > 0) ? ($calificacion / count($eval_)) : 0;
            foreach($eval_ as $e){
                $f = $e;
                $f['calificacion_indicador'] = $calificacionIndicador;
                $eval[] = $f;
            }
            
            $datos[] = array('descripcion_estandar'=>$ind['descripcion_estandar'],  
                            'descripcion_indicador'=>$ind['descripcion'] ,
                            'codigo_indicador'=>$ind['codigo'] ,
                            'calificacion' => $calificacionIndicador,
                            'evaluacion' => $eval,
                            'category'=> $ind['codigo'] ,
                            'measure' => $calificacionIndicador
                        );
            $calificaciones[] = $calificacionIndicador;
            
        }
        $datos_original = $datos;
        array_multisort($calificaciones, SORT_DESC, $datos);
        $limite = (count($datos) > 10) ? 10 : count($datos);
        $datosT10 = $datos;
        $datosL10 = $datos;
        for($i = 0; $i < $limite; $i++){
           $less10[] = array_pop($datosL10);
           $top10[] = array_shift($datosT10);
        }
        $resp[] = array('datos'=>$datos_original, 'top10'=>$top10, 'less10'=>$less10);
        return $resp;
    }
    
    protected function getDatosEvaluacion(Formulario $Frm, $periodo, $datosIndicador){

        $totalCriterios = $datosIndicador['total_criterios']; 
        $porcentajeAprobacion = $datosIndicador['porcentaje_aceptacion']; 
        $formaEvaluacion = $datosIndicador['forma_evaluacion'] ;
        $alcance = $datosIndicador['alcance_evaluacion'] ;
        $em = $this->getEntityManager();
        list($anio, $mes) = explode('_', $periodo);
        
        $campos = $em->getRepository('GridFormBundle:Formulario')->getListaCampos($Frm);
        $periodo_lectura = '';
        if ($Frm->getPeriodoLecturaDatos() == 'mensual' and $mes != null){
            $periodo_lectura = " AND (A.datos->'mes')::integer = '$mes' ";
        }
        
        $frmId = $Frm->getId();
        $alcance_sql = "";
        if ($alcance == 'por_estandar'){
            $alcance_join = '';
            $alcance_where = " AND id_formulario = '$frmId' ";
        }elseif($alcance == 'por_indicador'){            
            $alcance_join = " INNER JOIN variable_captura AB ON (A.datos->'codigo_variable = AB.codigo) 
                                INNER JOIN indicador_variablecaptura AC ON (AB.id = AC.variablecaptura_id)";
            $alcance_where = " AND AC.indicador_id = '$datosIndicador[indicador_id]' ";
        }
        
        //Sacar los datos sobre los que se harán los cálculos
        $datos = "SELECT $campos, A.datos->'establecimiento' as establecimiento
                    FROM almacen_datos.repositorio A
                        $alcance_join
                     WHERE A.datos->'es_poblacion' = 'false'
                        $alcance_where
                        AND A.datos->'es_separador' = 'false'
                        AND A.datos->'anio' = '$anio'
                        $periodo_lectura";        
        if ($formaEvaluacion == 'cumplimiento_porcentaje_aceptacion'){
          $evaluacion = " ROUND((COALESCE(B.total_cumplimiento, 0)::numeric / A.total_expedientes::numeric * 100),2)  AS calificacion ";
        }elseif ($formaEvaluacion == 'cumplimiento_criterios') {
          $evaluacion = " ROUND((C.total_criterios_cumplidos::numeric / (A.total_expedientes::numeric * $totalCriterios) * 100),2) AS calificacion ";
        }
        $sql = "SELECT F.*, CE.nombre AS nombre_establecimiento FROM 
                (   SELECT A.establecimiento, A.total_expedientes, COALESCE(B.total_cumplimiento, 0) AS expedientes_cumple,
                    $totalCriterios AS criterios_evaluados, C.total_criterios_cumplidos,
                    $evaluacion                    
                    FROM 
                        (SELECT AA.establecimiento, COUNT(AA.nombre_pivote) AS total_expedientes
                            FROM (
                                SELECT establecimiento, nombre_pivote
                                FROM ($datos) AS D 
                                WHERE dato = 'true'
                                GROUP BY establecimiento, nombre_pivote
                            ) AS AA
                            GROUP BY AA.establecimiento
                        ) AS A
                    LEFT JOIN 
                        (   SELECT establecimiento, count(total_cumplimiento) AS total_cumplimiento
                            FROM (
                                SELECT establecimiento, COUNT(codigo_variable) AS total_cumplimiento
                                FROM ($datos) AS D
                                WHERE dato = 'true'
                                GROUP BY establecimiento, nombre_pivote
                                HAVING (COUNT(codigo_variable)/$totalCriterios * 100) >= $porcentajeAprobacion
                            ) AS BB
                            GROUP BY BB.establecimiento
                        ) AS B 
                        ON (A.establecimiento = B.establecimiento)
                    LEFT JOIN (
                        SELECT establecimiento, COUNT(codigo_variable) AS total_criterios_cumplidos
                            FROM ($datos) AS D
                            WHERE dato = 'true'
                            GROUP BY establecimiento
                    ) AS C ON (A.establecimiento = C.establecimiento)
                    INNER JOIN ctl_establecimiento_simmow ES ON (A.establecimiento = ES.id::text)                
                ) AS F
                    INNER JOIN costos.estructura CE ON (F.establecimiento = CE.codigo)
                ORDER BY calificacion DESC
         ";
        return $em->getConnection()->executeQuery($sql)->fetchAll();
    }
}
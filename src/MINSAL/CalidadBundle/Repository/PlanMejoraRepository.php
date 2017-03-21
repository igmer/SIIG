<?php

namespace MINSAL\CalidadBundle\Repository;

use Doctrine\ORM\EntityRepository;
use MINSAL\CalidadBundle\Entity\PlanMejora;
use MINSAL\CalidadBundle\Entity\Criterio;

/**
 * PlanMejoraRepository
 *
 */
class PlanMejoraRepository extends EntityRepository {

    /**
     * 
     * @param PlanMejora $planMejora
     * @param mixed $criterios, criterios a agregar al plan de mejora
     */
    public function agregarCriterios(PlanMejora $planMejora, $criterios) {
        $em = $this->getEntityManager();
        
        foreach ($criterios as $c){
            //Verificar si el criterio ya fue agregado
            $variableCaptura = $em->getRepository('GridFormBundle:VariableCaptura')->findOneBy(array('codigo'=>$c['codigo_variable']));
            $criterio_check = $em->getRepository("CalidadBundle:Criterio")->findOneBy(array('planMejora'=>$planMejora, 'variableCaptura' =>$variableCaptura));

            if ($criterio_check === null){
                //Si no está agregarlo
                $nCriterio = new Criterio();
                $nCriterio->setPlanMejora($planMejora);
                $nCriterio->setVariableCaptura($variableCaptura);
                $nCriterio->setBrecha($c['brecha']);
                $em->persist($nCriterio);
            } else {
                //Si ya existe actualizar brecha
                $criterio_check->setBrecha($c['brecha']);
                $em->persist($criterio_check);
            }
            
        }
        
        $em->flush();
        
    }
    
    public function getCriteriosOrden(PlanMejora $planMejora) {
        
        $ind = '';
        $ord = '';
        if ($planMejora->getEstandar()->getFormaEvaluacion() == 'rango_colores'){
            $ind = ' INNER JOIN V.area AR ';
            $ord = ' V.area, ';
        }
        $criterios =  $this->getEntityManager()
            ->createQuery(
                "SELECT C
                    FROM CalidadBundle:Criterio C
                    INNER JOIN C.variableCaptura V
                    $ind
                    WHERE C.planMejora = :plan
                    ORDER BY $ord V.posicion ASC
                    "
            )
            ->setParameters(array('plan'=>$planMejora))
            ->getResult();
        
        return $criterios;
                
    }

}
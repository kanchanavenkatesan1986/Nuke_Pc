package com.tvkmovies.main;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class NukeService {	
	
	@Autowired
	NukeRepository repo;
	
	//GET All
	public List<NukePc> fetchallpc(){
		return repo.findAll();
	} 
	
	//GET ID
	public NukePc fetchpcinfo(int id) {
		return repo.findById(id).orElse(null);
		
	}
	
	//POST
	public String addpc(NukePc pc){
		repo.save(pc);
		return "Pc Information Added!!!!!!!!!!!!!!!!!!";
	}
	
	//DELETE
	public String deletepc(int id) {
		repo.deleteById(id);
		return "Pc info delete";
		
	}
	
	//PUT
	
	public String updatepc(int id ,NukePc pc) {
		
		NukePc oldpc = repo.findById(id).orElse(null);
		
		oldpc.setCustomer(pc.getCustomer());
		oldpc.setCpu_processor(pc.getCpu_processor());
		oldpc.setGpu_graphicscard(pc.getGpu_graphicscard());
		oldpc.setMotherboard(pc.getMotherboard());
		oldpc.setRam_memory(pc.getRam_memory());
		oldpc.setStorage_drive(pc.getStorage_drive());
		repo.save(oldpc);
		return "pc  updated!!!!!!!!!!!1";
		
	}
	
	//PATCH
	public String updatepcinfo(int id,NukePc pc) {
		
        NukePc oldpc = repo.findById(id).orElse(null);
        
        if(pc.getCustomer()!=null) {
        	oldpc.setCustomer(pc.getCustomer());
        }
        
        if(pc.getCpu_processor()!=null) {
        	oldpc.setCpu_processor(pc.getCpu_processor());
        }
        
        if(pc.getGpu_graphicscard()!=null) {
        	oldpc.setGpu_graphicscard(pc.getGpu_graphicscard());
        }
        
        if(pc.getMotherboard()!=null) {
        	oldpc.setMotherboard(pc.getMotherboard());
        }
        
        if(pc.getRam_memory()!=null) {
        	oldpc.setRam_memory(pc.getRam_memory());
        }
        if(pc.getStorage_drive()!=null) {
        	oldpc.setStorage_drive(pc.getStorage_drive());
        }
		
        
		repo.save(oldpc);
		
		return "pc Info updated!!!!!!!!!!!";
		
	}
	

}

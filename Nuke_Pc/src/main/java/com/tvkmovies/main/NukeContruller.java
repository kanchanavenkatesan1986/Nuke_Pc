package com.tvkmovies.main;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

@RestController
@RequestMapping("/admin")
public class NukeContruller {
	
	@Autowired
	NukeService service;
	
	//GET All
	@GetMapping("/getallpc")
	public List<NukePc> getallpc(){
		return service.fetchallpc();
	}
	
	//GET ID
	@GetMapping("/getpcinfo/{id}")
	public NukePc getpcinfo(@PathVariable int id) {
		return service.fetchpcinfo(id);
		
	}

	//POST
	@PostMapping("/addpc")
	public String addpc(@RequestBody NukePc pc) {
		return service.addpc(pc);
		
	}
	
	//DELETE
	@DeleteMapping("/deletepc/{id}")
	public String deletepc(@PathVariable int id) {
		return service.deletepc(id);
		
	}
	
	//PUT
	@PutMapping("/update/{id}")
	public String updatepc(@PathVariable int id,@RequestBody NukePc pc) {
		return service.updatepc(id, pc);
		
	}
	
	//PATCH
	public String updatepcinfo(@PathVariable int id ,@RequestBody NukePc pc) {
		return service.updatepcinfo(id,pc);
	}
	
	
	

}
